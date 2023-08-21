import os
import re

from .log import log_node_warn, log_node_info, log_node_success

from .constants import get_category, get_name
from nodes import LoraLoader, CLIPTextEncode
import folder_paths

NODE_NAME=get_name('Power Prompt')

def get_and_strip_loras(prompt, silent=False):
    pattern='<lora:([^:>]*?)(?::(-?\d*(?:\.\d*)?))?>'
    lora_paths=folder_paths.get_filename_list('loras')
    lora_filenames_no_ext=[os.path.splitext(os.path.basename(x))[0] for x in lora_paths]

    matches = re.findall(pattern, prompt)

    loras=[]
    for match in matches:
        tag_filename=match[0]
        strength=float(match[1] if len(match) > 1 and len(match[1]) else 1.0)
        if strength == 0 and not silent:
            log_node_info(NODE_NAME, f'Skipping "{tag_filename}" with strength of zero')

        # Let's be flexible. If the lora filename in the tag doesn't have the extension or
        # path prefix, let's still find and load it.
        if tag_filename not in lora_paths:
            found_tag_filename=None
            for index, value in enumerate(lora_filenames_no_ext):
                if value in tag_filename:
                    found_tag_filename=lora_paths[index]
                    break
            if found_tag_filename:
                # if not silent:
                #     log_node_info(NODE_NAME, f'Found "{found_tag_filename}" for "{tag_filename}" in prompt')
                tag_filename=found_tag_filename
            else:
                if not silent:
                    log_node_warn(NODE_NAME, f'Lora "{tag_filename}" not found, skipping.')
                continue

        loras.append({'lora':tag_filename, 'strength':strength})

    return (re.sub(pattern, '', prompt), loras)



class RgthreePowerPrompt:

    NAME = NODE_NAME
    CATEGORY = get_category()

    @classmethod
    def INPUT_TYPES(s):
        SAVED_PROMPTS_FILES=folder_paths.get_filename_list('saved_prompts')
        SAVED_PROMPTS_CONTENT=[]
        for filename in SAVED_PROMPTS_FILES:
            with open(folder_paths.get_full_path('saved_prompts', filename), 'r') as f:
                SAVED_PROMPTS_CONTENT.append(f.read())
        return {
            'required': {
                'prompt': ('STRING', {'multiline': True}),
            },
            'optional': {
                "opt_model": ("MODEL",),
                "opt_clip": ("CLIP", ),
                'insert_lora': (['CHOOSE', 'DISABLE LORAS'] + [os.path.splitext(x)[0] for x in folder_paths.get_filename_list('loras')],),
                'insert_embedding': (['CHOOSE',] + [os.path.splitext(x)[0] for x in folder_paths.get_filename_list('embeddings')],),
                'insert_saved': (['CHOOSE',] + SAVED_PROMPTS_FILES,),
            },
            'hidden': {
                'values_insert_saved': (['CHOOSE'] + SAVED_PROMPTS_CONTENT,),
            }
        }

    RETURN_TYPES = ('CONDITIONING', 'MODEL', 'CLIP', 'STRING',)
    RETURN_NAMES = ('CONDITIONING', 'MODEL', 'CLIP', 'TEXT',)
    FUNCTION = 'main'

    def main(self, prompt, opt_model=None, opt_clip=None, insert_lora=None,  insert_embedding=None, insert_saved=None, values_insert_saved=None):
        if insert_lora == 'DISABLE LORAS':
            prompt, loras = get_and_strip_loras(prompt, True)
            log_node_info(NODE_NAME, f'Disabling all found loras ({len(loras)}) and stripping lora tags for TEXT output.')
        elif opt_model != None and opt_clip != None:
            prompt, loras = get_and_strip_loras(prompt)
            if len(loras):
                for lora in loras:
                    opt_model, opt_clip = LoraLoader().load_lora(opt_model, opt_clip, lora['lora'], lora['strength'], lora['strength'])
                    log_node_success(NODE_NAME, f'Loaded "{lora["lora"]}" from prompt')
                log_node_info(NODE_NAME, f'{len(loras)} Loras processed; stripping tags for TEXT output.')
        elif '<lora:' in prompt:
            _prompt_stripped, loras = get_and_strip_loras(prompt, True)
            if len(loras):
                log_node_warn(NODE_NAME, f'Found {len(loras)} lora tags in prompt but model & clip were not supplied!')
                log_node_info(NODE_NAME, f'Loras not processed, keeping for TEXT output.')

        conditioning=None
        if opt_clip != None:
            conditioning = CLIPTextEncode().encode(opt_clip, prompt)[0]


        return (conditioning, opt_model, opt_clip, prompt)

