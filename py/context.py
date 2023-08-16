from .constants import get_category, get_name

ctx_keys = ["model", "clip", "vae", "positive", "negative", "latent", "images", "seed"]
def new_context(context=None, model=None, clip=None, vae=None, positive=None, negative=None, latent=None, images=None, seed=None):
    ctx = {}
    for key in ctx_keys:
        v = None
        v = v if v != None else model if key == 'model' else None
        v = v if v != None else clip if key == 'clip' else None
        v = v if v != None else vae if key == 'vae' else None
        v = v if v != None else positive if key == 'positive' else None
        v = v if v != None else negative if key == 'negative' else None
        v = v if v != None else latent if key == 'latent' else None
        v = v if v != None else images if key == 'images' else None
        v = v if v != None else seed if key == 'seed' else None
        ctx[key] = a_b(v, d_k(context, key))
    return ctx

def d_k(dct, key, default=None):
    return dct[key] if dct != None and key in dct else default

def a_b(a, b):
    return a if a != None else b


class RgthreeContext:

    NAME = get_name('Context')
    CATEGORY = get_category()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {
                "base_ctx": ("RGTHREE_CONTEXT",),
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "vae": ("VAE",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent": ("LATENT",),
                "images": ("IMAGE", ),
                "seed": ("INT", {"forceInput": True}),
            },
            "hidden": {
                "prompt": "PROMPT",
            },
        }
    RETURN_TYPES = ("RGTHREE_CONTEXT", "MODEL", "CLIP", "VAE", "CONDITIONING", "CONDITIONING", "LATENT", "IMAGE", "INT",)
    RETURN_NAMES = ("CONTEXT", "MODEL", "CLIP", "VAE", "POSITIVE", "NEGATIVE", "LATENT", "IMAGE", "SEED",)
    FUNCTION = "convert"


    def convert(self, base_ctx=None, model=None, clip=None, vae=None, positive=None, negative=None, latent=None, images=None, seed=None, prompt=None):
        ctx = new_context(context=base_ctx, model=model, clip=clip, vae=vae, positive=positive, negative=negative, latent=latent, images=images, seed=seed)
        return (ctx, ctx['model'], ctx['clip'], ctx['vae'], ctx['positive'], ctx['negative'], ctx['latent'], ctx['images'], ctx['seed'],)

