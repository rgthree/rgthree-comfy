from .log import log_node_info
from .constants import get_category, get_name
from nodes import MAX_RESOLUTION


def getNewBounds(width, height, left, right, top, bottom):
    left = 0 + left
    right = width - right
    top = 0 + top
    bottom = height - bottom
    return (left, right, top, bottom)

class RgthreeImageInsetCrop:

    NAME = get_name('Image Inset Crop')
    CATEGORY = get_category()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "measurement": (['Pixels', 'Percentage'],),
                "left": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 8}),
                "right": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 8}),
                "top": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 8}),
                "bottom": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 8}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "crop"

    def crop(self, measurement, left, right, top, bottom, image=None):

        _, height, width, _ = image.shape

        if measurement == 'Percentage':
            left = int(width - (width * (100-left) / 100))
            right = int(width - (width * (100-right) / 100))
            top = int(height - (height * (100-top) / 100))
            bottom = int(height - (height * (100-bottom) / 100))

        # Snap to 8 pixels
        left = left // 8 * 8
        right = right // 8 * 8
        top = top // 8 * 8
        bottom = bottom // 8 * 8

        if left == 0 and right == 0 and bottom == 0 and top == 0:
            return (image,)

        inset_left, inset_right, inset_top, inset_bottom = getNewBounds(width, height, left, right, top, bottom)
        if (inset_top > inset_bottom):
            raise ValueError(f"Invalid cropping dimensions top ({inset_top}) exceeds bottom ({inset_bottom})")
        if (inset_left > inset_right):
            raise ValueError(f"Invalid cropping dimensions left ({inset_left}) exceeds right ({inset_right})")

        log_node_info(self.NAME, f'Cropping image {width}x{height} width inset by {inset_left},{inset_right}, and height inset by {inset_top}, {inset_bottom}')
        image = image[:, inset_top:inset_bottom, inset_left:inset_right, :]

        return (image,)


