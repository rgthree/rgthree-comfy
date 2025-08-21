import asyncio
import folder_paths

from typing import Union

from nodes import LoraLoader
from .constants import get_category, get_name
from .power_prompt_utils import get_lora_by_filename
from .utils import FlexibleOptionalInputType, any_type
from .server.utils_info import get_model_info
from .log import log_node_warn

NODE_NAME = get_name('Power Lora Loader Template')


class RgthreePowerLoraLoaderTemplate:
  """ The Power Lora Loader Template is a powerful, flexible node to add multiple loras to a model/clip with template functionality."""

  NAME = NODE_NAME
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
      },
      # Since we will pass any number of loras in from the UI, this needs to always allow an
      "optional": FlexibleOptionalInputType(type=any_type, data={
        "model": ("MODEL",),
        "clip": ("CLIP",),
      }),
      "hidden": {},
    }

  RETURN_TYPES = ("MODEL", "CLIP")
  RETURN_NAMES = ("MODEL", "CLIP")
  FUNCTION = "load_loras"

  def load_loras(self, model=None, clip=None, **kwargs):
    """Loops over the provided loras in kwargs and applies valid ones."""
    for key, value in kwargs.items():
      key = key.upper()
      if key.startswith('LORA_') and 'on' in value and 'lora' in value and 'strength' in value:
        strength_model = value['strength']
        # If we just passed one strength value, then use it for both, if we passed a strengthTwo
        # as well, then our `strength` will be for the model, and `strengthTwo` for clip.
        strength_clip = value['strengthTwo'] if 'strengthTwo' in value else None
        if clip is None:
          if strength_clip is not None and strength_clip != 0:
            log_node_warn(NODE_NAME, 'Recieved clip strength eventhough no clip supplied!')
          strength_clip = 0
        else:
          strength_clip = strength_clip if strength_clip is not None else strength_model
        if value['on'] and (strength_model != 0 or strength_clip != 0):
          lora = get_lora_by_filename(value['lora'], log_node=self.NAME)
          if model is not None and lora is not None:
            model, clip = LoraLoader().load_lora(model, clip, lora, strength_model, strength_clip)

    return (model, clip)