"""The Power Puter is a powerful node that can compute and evaluate Python-like code safely allowing
for complex operations for primitives and workflow items for output. From string concatenation, to
math operations, list comprehension, and node value output.

Originally based off https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/aac13aa7ce35b07d43633c3bbe654a38c00d74f5/py/math_expression.py
under an MIT License https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/aac13aa7ce35b07d43633c3bbe654a38c00d74f5/LICENSE
"""

import math
import ast
import json
import random
import dataclasses
import re

from typing import Any, Callable
import operator as op
from .constants import get_category, get_name
from .utils import FlexibleOptionalInputType, any_type, get_dict_value


@dataclasses.dataclass(frozen=True, kw_only=True)
class Function():
  """Function data.

  Attributes:
    name: The name of the function as called from the node.
    call: The callable (reference, lambda, etc), or a string if on _Puter instance.
    args: A tuple that represents the minimum and maximum number of args (or arg for no limit).
  """

  name: str
  call: Callable | str
  args: tuple[int, int | None]


_FUNCTIONS = {
  fn.name: fn for fn in [
    Function(name="round", call=round, args=(1, 2)),
    Function(name="ceil", call=math.ceil, args=(1, 1)),
    Function(name="floor", call=math.floor, args=(1, 1)),
    Function(name="sqrt", call=math.sqrt, args=(1, 1)),
    Function(name="min", call=min, args=(2, None)),
    Function(name="max", call=max, args=(2, None)),
    Function(name="random_int", call=random.randint, args=(2, 2)),
    Function(name="random_choice", call=random.choice, args=(2, None)),
    # Casts
    Function(name="int", call=int, args=(1, 1)),
    Function(name="float", call=float, args=(1, 1)),
    Function(name="str", call=str, args=(1, 1)),
    Function(name="bool", call=bool, args=(1, 1)),
    # Special
    Function(name="node", call='_get_node', args=(1, 1)),
    Function(name="nodes", call='_get_nodes', args=(0, 1)),
    Function(name="dir", call=dir, args=(1, 1)),
    Function(name="type", call=type, args=(1, 1)),
  ]
}

# A list of function names (from above) that could change without us knowing (globally available in
# the prompt, no from an input). This allows us to always mark the node as changed since we cannot
# tell.
_GLOBAL_FUNCTION_NAMES = ['node', 'nodes']


# Special functions by class type (called from the Attrs.)
_SPECIAL_FUNCTIONS = {
  "Power Lora Loader (rgthree)": {
    # Get a list of the enabled loras from a power lora loader.
    "loras":
      lambda node: [{
        'name': lora['lora'],
        'strength': lora['strength']
      } | ({
        'strength_clip': lora['strengthTwo']
      } if 'strengthTwo' in lora else {})
                    for name, lora in node['inputs'].items()
                    if name.startswith('lora_') and lora['on']]
  }
}


_OPERATORS = {
  ast.Add: op.add,
  ast.Sub: op.sub,
  ast.Mult: op.mul,
  ast.Div: op.truediv,
  ast.FloorDiv: op.floordiv,
  ast.Pow: op.pow,
  ast.BitXor: op.xor,
  ast.USub: op.neg,
  ast.Mod: op.mod,
  ast.BitAnd: op.and_,
  ast.BitOr: op.or_,
  ast.Invert: op.invert,
  ast.And: lambda a, b: 1 if a and b else 0,
  ast.Or: lambda a, b: 1 if a or b else 0,
  ast.Not: lambda a: 0 if a else 1,
  ast.RShift: op.rshift,
  ast.LShift: op.lshift
}

_IS_CHANGED_GLOBAL = 0


class RgthreePowerPuter:
  """A powerful node that can compute and evaluate expressions and output as various types."""

  NAME = get_name("Power Puter")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": FlexibleOptionalInputType(any_type),
      "hidden": {
        "extra_pnginfo": "EXTRA_PNGINFO",
        "prompt": "PROMPT"
      },
    }

  RETURN_TYPES = (any_type,)
  RETURN_NAMES = ('*',)
  FUNCTION = "main"

  @classmethod
  def IS_CHANGED(cls, **kwargs):
    """Forces a changed state if we could be unaware of data changes (like using `node()`)."""
    global _IS_CHANGED_GLOBAL
    for gn in _GLOBAL_FUNCTION_NAMES:
      if f'{gn}(' in kwargs['code']:
        _IS_CHANGED_GLOBAL += 1
        break
    return _IS_CHANGED_GLOBAL

  def main(self, **kwargs):
    """Does the nodes' work."""
    output = kwargs['output']
    code = kwargs['code']
    pnginfo = kwargs['extra_pnginfo']
    workflow = pnginfo["workflow"] if "workflow" in pnginfo else {"nodes": []}
    prompt = kwargs['prompt']

    ctx = {**kwargs}
    del ctx['output']
    del ctx['code']
    del ctx['extra_pnginfo']
    del ctx['prompt']

    eva = _Puter(code=code, ctx=ctx, workflow=workflow, prompt=prompt)
    value = eva.execute()

    if value is not None:
      if output == 'INT':
        value = int(value)
      elif output == 'FLOAT':
        value = float(value)
      elif output == 'BOOL':
        value = bool(value)
      elif isinstance(value, (dict, list)):
        value = json.dumps(value, indent=2)
      else:
        value = str(value)

    return (value,)


class _Puter:
  """The main computation evaluator, using ast.parse the code.

  See https://www.basicexamples.com/example/python/ast for examples.
  """

  def __init__(self, *, code: str, ctx: dict[str, Any], workflow, prompt):
    ctx = ctx or {}
    self._ctx = {**ctx}
    self._code = code
    self._workflow = workflow
    self._prompt = prompt

  def execute(self, code=str | None) -> Any:
    """Evaluates a the code block."""
    code = code or self._code
    node = ast.parse(self._code)
    last_value = None
    for body in node.body:
      last_value = self._eval_statement(body)
      # If we got a return, then that's it folks.
      if isinstance(body, ast.Return):
        break
    return last_value

  def _get_nodes(self, node_id: int | str | None = None) -> dict[str, Any]:
    """Get a dict of the nodes that match the node_id, or all the nodes in the prompt."""
    if not node_id:
      return {**self._prompt}
    node_id = str(node_id)
    nodes = []
    if re.match(r'\d+$', node_id):
      nodes = {id: n for id, n in self._prompt.items() if node_id == id}
    if not nodes:
      nodes = {
        id: n for id, n in self._prompt.items() if node_id == get_dict_value(n, '_meta.title', '')
      }
    return nodes

  def _get_node(self, node_id: int | str):
    """Returns a prompt-node from the hidden prompt."""
    node_id = str(node_id)
    nodes = [n for n in self._get_nodes(node_id).values()]
    if nodes and len(nodes) > 1:
      print('ERROR more than one node, returning first.')
    return nodes[0] if nodes else None

  def _eval_statement(self, stmt: ast.stmt, ctx: dict | None = None):
    """Evaluates an ast.stmt."""
    ctx = self._ctx if ctx is None else ctx

    # print('\n\n----: _eval_statement')
    # print(type(stmt))
    # print(ctx)

    if isinstance(stmt, (ast.FormattedValue, ast.Expr)):
      return self._eval_statement(stmt.value, ctx=ctx)

    if isinstance(stmt, (ast.Constant, ast.Num)):
      return stmt.n

    if isinstance(stmt, ast.BinOp):
      left = self._eval_statement(stmt.left, ctx=ctx)
      right = self._eval_statement(stmt.right, ctx=ctx)
      return _OPERATORS[type(stmt.op)](left, right)

    if isinstance(stmt, ast.BoolOp):
      left = self._eval_statement(stmt.values[0], ctx=ctx)
      # If we're an AND and already false, then don't even evaluate the right.
      if isinstance(stmt.op, ast.And) and not left:
        return left
      right = self._eval_statement(stmt.values[1], ctx=ctx)
      return _OPERATORS[type(stmt.op)](left, right)

    if isinstance(stmt, ast.UnaryOp):
      return _OPERATORS[type(stmt.op)](self._eval_statement(stmt.operand), ctx=ctx)

    if isinstance(stmt, (ast.Attribute, ast.Subscript)):
      # Like: node(14).inputs.sampler_name (Attribute)
      # Like: node(14)['inputs']['sampler_name'] (Subscript)
      item = self._eval_statement(stmt.value, ctx=ctx)
      attr = stmt.attr if hasattr(stmt, 'attr') else stmt.slice.value
      try:
        val = item[attr]
      except (TypeError, IndexError, KeyError):
        try:
          val = getattr(item, attr)
        except AttributeError:
          # If we're a dict, then just return None instead of error; saves time.
          if isinstance(item, dict):
            # Any special cases in the _SPECIAL_FUNCTIONS
            class_type = get_dict_value(item, "class_type")
            if class_type in _SPECIAL_FUNCTIONS and attr in _SPECIAL_FUNCTIONS[class_type]:
              val = _SPECIAL_FUNCTIONS[class_type][attr](item)
            else:
              val = None
          else:
            raise
      return val

    # f-strings: https://www.basicexamples.com/example/python/ast-JoinedStr
    # Note, this will str() all evaluated items in the fstrings, and doesn't handle f-string
    # directives, like padding, etc.
    if isinstance(stmt, ast.JoinedStr):
      vals = [str(self._eval_statement(v, ctx=ctx)) for v in stmt.values]
      val = ''.join(vals)
      return val

    if isinstance(stmt, ast.Name):
      if stmt.id in ctx:
        val = ctx[stmt.id]
        return val
      raise NameError(f"Name not found: {stmt.id}")

    if isinstance(stmt, ast.ListComp):
      # Like: [v.lora for name, v in node(19).inputs.items() if name.startswith('lora_')]
      # Like: [v.lower() for v in lora_list]
      # Like: [v for v in l if v.startswith('B')]
      # Like: [v.lower() for v in l if v.startswith('B') or v.startswith('F')]
      final_list = []

      for gen in stmt.generators:
        gen_ctx = {**ctx}
        if isinstance(gen.target, ast.Tuple):
          gen_ctx[gen.target.elts[0].id] = None
          gen_ctx[gen.target.elts[1].id] = None
        elif isinstance(gen.target, ast.Name):
          gen_ctx[gen.target.id] = None

        # A call, like my_dct.items(), or a named ctx list
        if isinstance(gen.iter, ast.Call):
          iter = self._eval_statement(gen.iter.func, ctx=gen_ctx)()
        elif isinstance(gen.iter, (ast.Name, ast.Attribute)):
          iter = self._eval_statement(gen.iter, ctx=gen_ctx)

        for v in iter:
          # Unpack if we were a dict, otherwise it's just the item
          if isinstance(v, (tuple, list)):
            gen_ctx[gen.target.elts[0].id] = v[0]
            gen_ctx[gen.target.elts[1].id] = v[1]
          else:
            gen_ctx[gen.target.id] = v

          good = True
          for ifcall in gen.ifs:
            if not self._eval_statement(ifcall, ctx=gen_ctx):
              good = False
              break
          if not good:
            continue

          final_list.append(self._eval_statement(stmt.elt, gen_ctx))
        return final_list

    if isinstance(stmt, ast.Call):
      if isinstance(stmt.func, ast.Attribute):
        call = self._eval_statement(stmt.func, ctx=ctx)
      if isinstance(stmt.func, ast.Name):
        name = stmt.func.id
        if name in _FUNCTIONS:
          fn = _FUNCTIONS[name]
          call = fn.call
          if isinstance(call, str):
            call = getattr(self, call)
          num_args = len(stmt.args)
          if num_args < fn.args[0] or (fn.args[1] is not None and num_args > fn.args[1]):
            toErr = " or more" if fn.args[1] is None else f" to {fn.args[1]}"
            raise SyntaxError(f"Invalid function call: {fn.name} requires {fn.args[0]}{toErr} args")
      if not call:
        raise ValueError(f'No call for ast.Call {stmt}')
      args = []
      for arg in stmt.args:
        args.append(self._eval_statement(arg, ctx=ctx))
      return call(*args)

    if isinstance(stmt, ast.Compare):
      l = self._eval_statement(stmt.left, ctx=ctx)
      r = self._eval_statement(stmt.comparators[0], ctx=ctx)
      if isinstance(stmt.ops[0], ast.Eq):
        return 1 if l == r else 0
      if isinstance(stmt.ops[0], ast.NotEq):
        return 1 if l != r else 0
      if isinstance(stmt.ops[0], ast.Gt):
        return 1 if l > r else 0
      if isinstance(stmt.ops[0], ast.GtE):
        return 1 if l >= r else 0
      if isinstance(stmt.ops[0], ast.Lt):
        return 1 if l < r else 0
      if isinstance(stmt.ops[0], ast.LtE):
        return 1 if l <= r else 0
      if isinstance(stmt.ops[0], ast.In):
        return 1 if l in r else 0
      raise NotImplementedError("Operator " + stmt.ops[0].__class__.__name__ + " not supported.")

    # Assign a variable and add it to our ctx.
    if isinstance(stmt, ast.Assign):
      value = self._eval_statement(stmt.value, ctx=ctx)
      self._ctx[stmt.targets[0].id] = value
      return value

    raise TypeError(stmt)
