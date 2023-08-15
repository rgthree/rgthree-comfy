from constants import category_prefix, get_name

class RgthreeContextSwitch:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {
                "ctx_01": ("RGTHREE_CONTEXT",),
                "ctx_02": ("RGTHREE_CONTEXT",),
                "ctx_03": ("RGTHREE_CONTEXT",),
                "ctx_04": ("RGTHREE_CONTEXT",),
            },
            "hidden": {
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ("RGTHREE_CONTEXT",)
    RETURN_NAMES = ("CONTEXT",)
    FUNCTION = "switch"

    CATEGORY = "%s/utils" % category_prefix

    def switch(self, ctx_01=None, ctx_02=None, ctx_03=None, ctx_04=None, prompt=None):
        if ctx_01 != None:
            return (ctx_01,)
        if ctx_02 != None:
            return (ctx_02,)
        if ctx_03 != None:
            return (ctx_03,)
        if ctx_04 != None:
            return (ctx_04,)
        return (None,)


NODE_CLASS_MAPPINGS = {}
NODE_CLASS_MAPPINGS[get_name('Context Switch')] = RgthreeContextSwitch
