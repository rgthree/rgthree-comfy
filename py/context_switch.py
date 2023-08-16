from .constants import get_category, get_name

class RgthreeContextSwitch:

    NAME = get_name('Context Switch')
    CATEGORY = get_category()

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

