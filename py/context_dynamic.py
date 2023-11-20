"""The Dynamic Context node."""
from .constants import get_category, get_name
from .utils import ByPassTypeTuple


class RgthreeDynamicContext:
  """The Dynamic Context node.

  Similar to the static Context and Context Big nodes, this allows users to add any number and
  variety of inputs to a Dynamic Context node, and return the outputs by key name.
  """

  NAME = get_name("Dynamic Context")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name,missing-function-docstring
    return {
      "required": {},
      "optional": {
        "base_ctx": ("DYNAMIC_CONTEXT",),
        "output_keys": ("DYNAMIC_CONTEXT_OUTPUTS",),  # This is a hidden widget of the output keys
      },
      "hidden": {},
    }

  RETURN_TYPES = ByPassTypeTuple(("DYNAMIC_CONTEXT",))
  RETURN_NAMES = ByPassTypeTuple(("CONTEXT",))
  FUNCTION = "main"

  def main(self, base_ctx=None, output_keys=None, **kwargs):
    """Creates a new context from the provided data, with an optional base ctx to start."""
    new_ctx = base_ctx.copy() if base_ctx is not None else {}

    for key_raw, value in kwargs.items():
      key = key_raw.upper()
      if key.startswith('+ '):
        key = key[2:]
      if key == "base_ctx":
        continue
      new_ctx[key] = value

    res = [new_ctx]
    output_keys = output_keys.split(',') if output_keys is not None else []
    for key in output_keys:
      res.append(new_ctx[key] if key in new_ctx else None)
    return tuple(res)
