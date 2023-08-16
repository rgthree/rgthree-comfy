from .constants import get_category, get_name

class RgthreeDisplayInt:

    NAME = get_name('Display Int')
    CATEGORY = get_category()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input": ("INT", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "main"
    OUTPUT_NODE = True


    def main(self, input=None):
        return {"ui": {"text": (input,)}}

