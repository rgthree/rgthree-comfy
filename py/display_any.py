"""Display any data node."""
import json
from .constants import get_category, get_name


class RgthreeDisplayAny:
  """Display any data node."""

  NAME = get_name('Display Any')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
        "source": ("*", {}),
      },
    }

  RETURN_TYPES = ()
  FUNCTION = "main"
  OUTPUT_NODE = True

  def main(self, source=None):
    """Main."""
    value = 'None'
    if source is not None:
      try:
        value = json.dumps(source)
      except Exception:
        try:
          value = str(source)
        except Exception:
          value = 'source exists, but could not be serialized.'

    return {"ui": {"text": (value,)}}
