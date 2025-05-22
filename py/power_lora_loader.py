from nodes import LoraLoader
from .constants import get_category, get_name
from .power_prompt_utils import get_lora_by_filename
from .utils import FlexibleOptionalInputType, any_type


class RgthreePowerLoraLoader:
  """ The Power Lora Loader is a powerful, flexible node to add multiple loras to a model/clip."""

  NAME = get_name('Power Lora Loader')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    optional: dict = FlexibleOptionalInputType(any_type)
    optional.update({"lora_stack": ("LORA_STACK", {"default": None}),})
    return {
      "required": {
        "model": ("MODEL",),
        "clip": ("CLIP",),
      },
      # Since we will pass any number of loras in from the UI, this needs to always allow an
      "optional": optional,
      "hidden": {},
    }

  RETURN_TYPES = ("MODEL", "CLIP", "LORA_STACK")
  RETURN_NAMES = ("MODEL", "CLIP", "LORA_STACK")
  FUNCTION = "load_loras"

  def load_loras(self, model, clip, **kwargs):
    """Loops over the provided loras in kwargs and applies valid ones."""
    # Grab the stack if provided
    lora_stack = kwargs.get("lora_stack", list())
    for key, value in kwargs.items():
      key = key.upper()
      if key.startswith('LORA_') and 'on' in value and 'lora' in value and 'strength' in value:
        strength_model = value['strength']
        # If we just passed one strtength value, then use it for both, if we passed a strengthTwo
        # as well, then our `strength` will be for the model, and `strengthTwo` for clip.
        strength_clip = value['strengthTwo'] if 'strengthTwo' in value and value[
          'strengthTwo'] is not None else strength_model
        if value['on'] and (strength_model != 0 or strength_clip != 0):
          lora = get_lora_by_filename(value['lora'], log_node=self.NAME)
          if lora is not None:
            lora_stack.extend([(lora, strength_model, strength_clip)])

    # Apply the accumulated LoRAs to the provided model
    # This would be a place to fork to say:
    # - only apply the LoRA in this node
    # - apply the ones here and in the stack
    for lora, strength_model, strength_clip in lora_stack:
        model, clip = LoraLoader().load_lora(model, clip, lora, strength_model, strength_clip)

    return (model, clip, lora_stack)
