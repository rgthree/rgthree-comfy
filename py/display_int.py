"""Display int."""
from .constants import get_category, get_name


class RgthreeDisplayInt:
  """Display int node."""

  NAME = get_name('Display Int')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
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
    """Display a passed in int for the UI."""
    return {"ui": {"text": (input,)}}
