import os
import inspect

from .constants import get_category, get_name
from nodes import LoraLoader
import folder_paths


class RgthreePowerPrompt:

    NAME = get_name('Power Prompt')
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
            'hidden': {
                'insert_embedding': (['Choose'] + folder_paths.get_filename_list('embeddings'),),
                'insert_saved': (['Choose'] + SAVED_PROMPTS_FILES,),
                'values_insert_saved': (['Choose'] + SAVED_PROMPTS_CONTENT,),
            }
        }

    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('TEXT',)
    FUNCTION = 'main'

    def main(self, prompt, insert_embedding=None, insert_saved=None, values_insert_saved=None):
        return (prompt,)

