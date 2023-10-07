"""A simpler SDXL Power Prompt that doesn't load Loras, like for negative."""
import os
import re
import folder_paths
from nodes import MAX_RESOLUTION, LoraLoader
from comfy_extras.nodes_clip_sdxl import CLIPTextEncodeSDXL
from .sdxl_power_prompt_postive import RgthreeSDXLPowerPromptPositive

from .log import log_node_warn, log_node_info, log_node_success

from .constants import get_category, get_name

NODE_NAME = get_name('SDXL Power Prompt - Simple / Negative')


class RgthreeSDXLPowerPromptSimple(RgthreeSDXLPowerPromptPositive):
  """A simpler SDXL Power Prompt that doesn't handle Loras."""

  NAME = NODE_NAME
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    saved_prompts_files = folder_paths.get_filename_list('saved_prompts')
    saved_promptes_content = []
    for fname in saved_prompts_files:
      with open(folder_paths.get_full_path('saved_prompts', fname), 'r', encoding="utf-8") as file:
        saved_promptes_content.append(file.read())

    return {
      'required': {
        'prompt_g': ('STRING', {
          'multiline': True
        }),
        'prompt_l': ('STRING', {
          'multiline': True
        }),
      },
      'optional': {
        "opt_clip": ("CLIP",),
        "opt_clip_width": ("INT", {
          "forceInput": True,
          "default": 1024.0,
          "min": 0,
          "max": MAX_RESOLUTION
        }),
        "opt_clip_height": ("INT", {
          "forceInput": True,
          "default": 1024.0,
          "min": 0,
          "max": MAX_RESOLUTION
        }),
        'insert_embedding': ([
          'CHOOSE',
        ] + [os.path.splitext(x)[0] for x in folder_paths.get_filename_list('embeddings')],),
        'insert_saved': ([
          'CHOOSE',
        ] + saved_prompts_files,),
        # We'll hide these in the UI for now.
        "target_width": ("INT", {
          "default": -1,
          "min": -1,
          "max": MAX_RESOLUTION
        }),
        "target_height": ("INT", {
          "default": -1,
          "min": -1,
          "max": MAX_RESOLUTION
        }),
        "crop_width": ("INT", {
          "default": -1,
          "min": -1,
          "max": MAX_RESOLUTION
        }),
        "crop_height": ("INT", {
          "default": -1,
          "min": -1,
          "max": MAX_RESOLUTION
        }),
      },
      'hidden': {
        'values_insert_saved': (['CHOOSE'] + saved_promptes_content,),
      }
    }

  RETURN_TYPES = ('CONDITIONING', 'STRING', 'STRING')
  RETURN_NAMES = ('CONDITIONING', 'TEXT_G', 'TEXT_L')
  FUNCTION = 'main'

  def main(self,
           prompt_g,
           prompt_l,
           opt_clip=None,
           opt_clip_width=None,
           opt_clip_height=None,
           insert_embedding=None,
           insert_saved=None,
           target_width=-1,
           target_height=-1,
           crop_width=-1,
           crop_height=-1,
           values_insert_saved=None):

    conditioning = self.get_conditioning(prompt_g, prompt_l, opt_clip, opt_clip_width,
                                         opt_clip_height, target_width, target_height, crop_width, crop_height)
    return (conditioning, prompt_g, prompt_l)
