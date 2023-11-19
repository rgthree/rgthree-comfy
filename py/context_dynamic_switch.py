"""The original Context Switch."""
from .constants import get_category, get_name
from .context_utils import is_context_empty
from .utils import ByPassTypeTuple


class RgthreeContextDynamicSwitch:
  """The initial Context Switch node.

  For now, this will remain as-is but is otherwise backwards compatible with other Context nodes
  outputs.
  """

  NAME = get_name("Dynamic Context Switch")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": {
        "output_keys": ("DYNAMIC_CONTEXT_OUTPUTS",),  # This is a hidden widget of the output keys
        "ctx_01": ("DYNAMIC_CONTEXT",),
        "ctx_02": ("DYNAMIC_CONTEXT",),
        "ctx_03": ("DYNAMIC_CONTEXT",),
        "ctx_04": ("DYNAMIC_CONTEXT",),
        "ctx_05": ("DYNAMIC_CONTEXT",),
      },
    }

  RETURN_TYPES = ByPassTypeTuple(("DYNAMIC_CONTEXT", ))
  RETURN_NAMES = ByPassTypeTuple(("CONTEXT", ))
  FUNCTION = "switch"

  def switch(self, output_keys=None, ctx_01=None, ctx_02=None, ctx_03=None, ctx_04=None, ctx_05=None):
    """Chooses the first non-empty Context to output.
    """
    base_ctx = None
    if not is_context_empty(ctx_01):
      base_ctx = ctx_01
    elif not is_context_empty(ctx_02):
      base_ctx = ctx_02
    elif not is_context_empty(ctx_03):
      base_ctx = ctx_03
    elif not is_context_empty(ctx_04):
      base_ctx = ctx_04
    elif not is_context_empty(ctx_05):
      base_ctx = ctx_05

    new_ctx = base_ctx.copy() if not is_context_empty(base_ctx) else None
    res = [new_ctx]
    output_keys = output_keys.split(',') if output_keys is not None else []
    for key in output_keys:
      if new_ctx is None:
        res.append(None)
      else:
        res.append(new_ctx[key] if key in new_ctx else None)

    return tuple(res)
