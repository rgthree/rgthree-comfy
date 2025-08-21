from .constants import get_category, get_name

NODE_NAME = get_name('Test Simple Node')

class RgthreeTestSimpleNode:
    """A minimal test node to verify registration works"""
    
    NAME = NODE_NAME
    CATEGORY = get_category()
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "test"}),
            },
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output",)
    FUNCTION = "process"
    
    def process(self, text):
        return (f"Processed: {text}",)