from nodes import PreviewImage

from .constants import get_category, get_name


class RgthreeImageComparer(PreviewImage):
  """A node that compares two images in the UI."""

  NAME = get_name('Image Comparer')
  CATEGORY = get_category()
  FUNCTION = "compare_images"

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
        "image_a": ("IMAGE",),
      },
      "optional": {
        "image_b": ("IMAGE",),
      },
      "hidden": {
        "prompt": "PROMPT",
        "extra_pnginfo": "EXTRA_PNGINFO"
      },
    }

  def compare_images(self,
                     image_a,
                     image_b=None,
                     filename_prefix="rgthree.compare.",
                     prompt=None,
                     extra_pnginfo=None):
    images = []
    images.append(image_a[0])
    if image_b is not None and len(image_b) > 0:
      images.append(image_b[0])
    elif len(image_a) > 1:
      images.append(image_b[1])
    else:
      raise ValueError(
        "You must supply two images; either both image_a & image_b, or two batch images in image_a")

    return self.save_images(images, filename_prefix, prompt, extra_pnginfo)
