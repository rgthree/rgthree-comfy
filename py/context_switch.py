from .constants import get_category, get_name

def is_context_empty(ctx):
    if ctx == None:
        return True
    return all(v == None for v in ctx.values())

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

    RETURN_TYPES = ("RGTHREE_CONTEXT", "MODEL", "CLIP", "VAE", "CONDITIONING", "CONDITIONING", "LATENT", "IMAGE", "INT",)
    RETURN_NAMES = ("CONTEXT", "MODEL", "CLIP", "VAE", "POSITIVE", "NEGATIVE", "LATENT", "IMAGE", "SEED",)
    FUNCTION = "switch"

    def switch(self, ctx_01=None, ctx_02=None, ctx_03=None, ctx_04=None, prompt=None):
        ctx=None
        if not is_context_empty(ctx_01):
            ctx = ctx_01
        elif not is_context_empty(ctx_02):
            ctx = ctx_02
        elif not is_context_empty(ctx_03):
            ctx = ctx_03
        elif not is_context_empty(ctx_04):
            ctx = ctx_04
        if ctx != None:
            return (ctx, ctx['model'], ctx['clip'], ctx['vae'], ctx['positive'], ctx['negative'], ctx['latent'], ctx['images'], ctx['seed'],)
        return (None,None,None,None,None,None,None,None,None,)

