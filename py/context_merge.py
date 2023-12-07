"""The Context Switch (Big)."""
from .constants import get_category, get_name
from .context_utils import (ORIG_CTX_RETURN_TYPES, ORIG_CTX_RETURN_NAMES,
                            merge_new_context, get_orig_context_return_tuple)


class RgthreeContextMerge:
  """The Context Merge Big node."""

  NAME = get_name("Context Merge")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": {
        "ctx_01": ("RGTHREE_CONTEXT",),
        "ctx_02": ("RGTHREE_CONTEXT",),
        "ctx_03": ("RGTHREE_CONTEXT",),
        "ctx_04": ("RGTHREE_CONTEXT",),
        "ctx_05": ("RGTHREE_CONTEXT",),
      },
    }

  RETURN_TYPES = ORIG_CTX_RETURN_TYPES
  RETURN_NAMES = ORIG_CTX_RETURN_NAMES
  FUNCTION = "merge"

  def merge(self, ctx_01=None, ctx_02=None, ctx_03=None, ctx_04=None, ctx_05=None):
    """Merges any non-null passed contexts; later ones overriding earlier.
    """
    ctx = merge_new_context(ctx_01, ctx_02, ctx_03, ctx_04, ctx_05)

    return get_orig_context_return_tuple(ctx)
