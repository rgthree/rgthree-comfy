from constants import category_prefix, get_name

class RgthreeSeed:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 1125899906842624}),
            },
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("SEED",)
    FUNCTION = "main"

    CATEGORY = "%s/utils" % category_prefix

    def main(self, seed=0):
        return (seed,)


NODE_CLASS_MAPPINGS = {}
NODE_CLASS_MAPPINGS[get_name('Seed')] = RgthreeSeed
