"""
@author: rgthree
@title: Comfy Nodes
@nickname: rgthree
@description: A bunch of nodes I created that I also find useful.
"""

import glob
import inspect
import os
import shutil

from server import PromptServer

from .py.log import log_welcome
from .py.context import RgthreeContext
from .py.context_switch import RgthreeContextSwitch
from .py.display_int import RgthreeDisplayInt
from .py.lora_stack import RgthreeLoraLoaderStack
from .py.seed import RgthreeSeed
from .py.sdxl_empty_latent_image import RgthreeSDXLEmptyLatentImage
from .py.power_prompt import RgthreePowerPrompt
from .py.power_prompt_simple import RgthreePowerPromptSimple
from .py.image_inset_crop import RgthreeImageInsetCrop

NODE_CLASS_MAPPINGS = {
    RgthreeContext.NAME: RgthreeContext,
    RgthreeContextSwitch.NAME: RgthreeContextSwitch,
    RgthreeDisplayInt.NAME: RgthreeDisplayInt,
    RgthreeLoraLoaderStack.NAME: RgthreeLoraLoaderStack,
    RgthreeSeed.NAME: RgthreeSeed,
    RgthreeSDXLEmptyLatentImage.NAME: RgthreeSDXLEmptyLatentImage,
    RgthreePowerPrompt.NAME: RgthreePowerPrompt,
    RgthreePowerPromptSimple.NAME: RgthreePowerPromptSimple,
    RgthreeImageInsetCrop.NAME: RgthreeImageInsetCrop,
}

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_DEV_JS=os.path.abspath(f'{THIS_DIR}/js')
DIR_PY=os.path.abspath(f'{THIS_DIR}/py')
DIR_WEB_JS=os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree')
if not os.path.exists(DIR_WEB_JS):
    os.makedirs(DIR_WEB_JS)

shutil.copytree(DIR_DEV_JS, DIR_WEB_JS, dirs_exist_ok=True)

nodes=[]
NOT_NODES=['constants','log','utils']

__all__ = ['NODE_CLASS_MAPPINGS']

for file in glob.glob('*.py', root_dir=DIR_PY) + glob.glob('*.js', root_dir=DIR_DEV_JS):
    name = os.path.splitext(file)[0]
    if name not in nodes and name not in NOT_NODES and not name.startswith('_') and not name.startswith('base'):
        nodes.append(name)

log_welcome(num_nodes=len(nodes))
