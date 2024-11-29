import json
from .constants import get_category, get_name


class AnyType(str):
  """A special class that is always equal in not equal comparisons. Credit to pythongosssss"""

  def __ne__(self, __value: object) -> bool:
    return False


any = AnyType("*")


class RgthreeDisplayAny:
  """Display any data node."""

  NAME = get_name('Display Any')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
        "source": (any, {}),
      },
    }

  RETURN_TYPES = ()
  FUNCTION = "main"
  OUTPUT_NODE = True

  def main(self, source=None):
    value = 'None'
    if isinstance(source, str):
      value = source
    elif isinstance(source, (int, float, bool)):
      value = str(source)
    elif source is not None:
      try:
        value = json.dumps(source)
      except Exception:
        try:
          value = str(source)
        except Exception:
          value = 'source exists, but could not be serialized.'

    return {"ui": {"text": (value,)}}


class RgthreeDisplayInt:
  """Old DisplayInt node.

  Can be ported over to DisplayAny if https://github.com/comfyanonymous/ComfyUI/issues/1527 fixed.
  """

  NAME = get_name('Display Int')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(s):
    return {
      "required": {
        "input": ("INT", {
          "forceInput": True
        }),
      },
    }

  RETURN_TYPES = ()
  FUNCTION = "main"
  OUTPUT_NODE = True

  def main(self, input=None):
    return {"ui": {"text": (input,)}}
