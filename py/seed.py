"""See node."""
from .constants import get_category, get_name


class RgthreeSeed:
  """See node."""

  NAME = get_name('Seed')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
        "seed": ("INT", {
          "default": 0,
          "min": -1125899906842624,
          "max": 1125899906842624
        }),
      },
    }

  RETURN_TYPES = ("INT",)
  RETURN_NAMES = ("SEED",)
  FUNCTION = "main"

  def main(self, seed=0):
    """Returns the passed seed on execution."""
    return (seed,)
