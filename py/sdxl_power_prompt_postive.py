import os
import re
from nodes import MAX_RESOLUTION
from comfy_extras.nodes_clip_sdxl import CLIPTextEncodeSDXL

from .log import log_node_warn, log_node_info, log_node_success
from .constants import get_category, get_name
from .power_prompt_utils import get_and_strip_loras
from nodes import LoraLoader, CLIPTextEncode
import folder_paths

NODE_NAME = get_name('SDXL Power Prompt - Positive')


class RgthreeSDXLPowerPromptPositive:
  """The Power Prompt for positive conditioning."""

  NAME = NODE_NAME
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    SAVED_PROMPTS_FILES = folder_paths.get_filename_list('saved_prompts')
    SAVED_PROMPTS_CONTENT = []
    for filename in SAVED_PROMPTS_FILES:
      with open(folder_paths.get_full_path('saved_prompts', filename), 'r') as f:
        SAVED_PROMPTS_CONTENT.append(f.read())
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
        "opt_model": ("MODEL",),
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
        'insert_lora': (['CHOOSE', 'DISABLE LORAS'] +
                        [os.path.splitext(x)[0] for x in folder_paths.get_filename_list('loras')],),
        'insert_embedding': ([
          'CHOOSE',
        ] + [os.path.splitext(x)[0] for x in folder_paths.get_filename_list('embeddings')],),
        'insert_saved': ([
          'CHOOSE',
        ] + SAVED_PROMPTS_FILES,),
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
        'values_insert_saved': (['CHOOSE'] + SAVED_PROMPTS_CONTENT,),
      }
    }

  RETURN_TYPES = ('CONDITIONING', 'MODEL', 'CLIP', 'STRING', 'STRING')
  RETURN_NAMES = ('CONDITIONING', 'MODEL', 'CLIP', 'TEXT_G', 'TEXT_L')
  FUNCTION = 'main'

  def main(self,
           prompt_g,
           prompt_l,
           opt_model=None,
           opt_clip=None,
           opt_clip_width=None,
           opt_clip_height=None,
           insert_lora=None,
           insert_embedding=None,
           insert_saved=None,
           target_width=-1,
           target_height=-1,
           crop_width=-1,
           crop_height=-1,
           values_insert_saved=None):

    if insert_lora == 'DISABLE LORAS':
      prompt_g, loras_g = get_and_strip_loras(prompt_g, True)
      prompt_l, loras_l = get_and_strip_loras(prompt_l, True)
      loras = loras_g + loras_l
      log_node_info(
        NODE_NAME,
        f'Disabling all found loras ({len(loras)}) and stripping lora tags for TEXT output.')
    elif opt_model != None and opt_clip != None:
      prompt_g, loras_g = get_and_strip_loras(prompt_g)
      prompt_l, loras_l = get_and_strip_loras(prompt_l)
      loras = loras_g + loras_l
      if len(loras):
        for lora in loras:
          opt_model, opt_clip = LoraLoader().load_lora(opt_model, opt_clip, lora['lora'],
                                                       lora['strength'], lora['strength'])
          log_node_success(NODE_NAME, f'Loaded "{lora["lora"]}" from prompt')
        log_node_info(NODE_NAME, f'{len(loras)} Loras processed; stripping tags for TEXT output.')
    elif '<lora:' in prompt_g or '<lora:' in prompt_l:
      _prompt_stripped_g, loras_g = get_and_strip_loras(prompt_g, True)
      _prompt_stripped_l, loras_l = get_and_strip_loras(prompt_l, True)
      loras = loras_g + loras_l
      if len(loras):
        log_node_warn(
          NODE_NAME, f'Found {len(loras)} lora tags in prompt but model & clip were not supplied!')
        log_node_info(NODE_NAME, 'Loras not processed, keeping for TEXT output.')

    conditioning = self.get_conditioning(prompt_g, prompt_l, opt_clip, opt_clip_width,
                                         opt_clip_height, target_width, target_height, crop_width,
                                         crop_height)

    return (conditioning, opt_model, opt_clip, prompt_g, prompt_l)

  def get_conditioning(self, prompt_g, prompt_l, opt_clip, opt_clip_width, opt_clip_height,
                       target_width, target_height, crop_width, crop_height):
    """Checks the inputs and gets the conditioning."""
    conditioning = None
    if opt_clip is not None:
      if opt_clip_width and opt_clip_height:
        target_width = target_width if target_width and target_width > 0 else opt_clip_width
        target_height = target_height if target_height and target_height > 0 else opt_clip_height
        crop_width = crop_width if crop_width and crop_width > 0 else 0
        crop_height = crop_height if crop_height and crop_height > 0 else 0
        conditioning = CLIPTextEncodeSDXL().encode(opt_clip, opt_clip_width, opt_clip_height,
                                                   crop_width, crop_height, target_width,
                                                   target_height, prompt_g, prompt_l)[0]
      else:
        # If we got an opt_clip, but no clip_width or _height, then use normal CLIPTextEncode
        log_node_info(
          self.NAME,
          'CLIP supplied, but not CLIP_WIDTH and CLIP_HEIGHT. Text encoding will use standard encoding with prompt_g and prompt_l concatenated.'
        )
        conditioning = CLIPTextEncode().encode(
          opt_clip, f'{prompt_g if prompt_g else ""}\n{prompt_l if prompt_l else ""}')[0]
    return conditioning
