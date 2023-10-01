import json

from .context_utils import is_context_empty
from .constants import get_category, get_name
from .utils import any_type


def is_none(value):
  """Checks if a value is none. Pulled out in case we want to expand what 'None' means."""
  if value is not None:
    if isinstance(value, dict) and 'model' in value and 'clip' in value:
      return is_context_empty(value)
  return value is None


class RgthreeAnySwitch:
  """The any switch. """

  NAME = get_name("Any Switch")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": {
        "any_01": (any_type,),
        "any_02": (any_type,),
        "any_03": (any_type,),
        "any_04": (any_type,),
        "any_05": (any_type,),
      },
    }

  RETURN_TYPES = (any_type,)
  RETURN_NAMES = ('*',)
  FUNCTION = "switch"

  def switch(self, any_01=None, any_02=None, any_03=None, any_04=None, any_05=None):
    """Chooses the first non-empty item to output."""
    any_value = None
    if not is_none(any_01):
      any_value = any_01
    elif not is_none(any_02):
      any_value = any_02
    elif not is_none(any_03):
      any_value = any_03
    elif not is_none(any_04):
      any_value = any_04
    elif not is_none(any_05):
      any_value = any_05
    return (any_value,)
