from constants import category_prefix, get_name

class RgthreeDisplayInt:
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

    CATEGORY = "%s/utils" % category_prefix

    def main(self, input=None):
        return {"ui": {"text": (input,)}}


NODE_CLASS_MAPPINGS = {}
NODE_CLASS_MAPPINGS[get_name('Display Int')] = RgthreeDisplayInt
