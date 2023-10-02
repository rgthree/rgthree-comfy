"""
@author: rgthree
@title: Comfy Nodes
@nickname: rgthree
@description: A bunch of nodes I created that I also find useful.
"""

import glob
import json
import os
import shutil
import re

from .config import RGTHREE_CONFIG

# from .server import server

from .py.log import log_welcome
from .py.context import RgthreeContext
from .py.context_switch import RgthreeContextSwitch
from .py.context_switch_big import RgthreeContextSwitchBig
from .py.display_any import RgthreeDisplayAny, RgthreeDisplayInt
from .py.lora_stack import RgthreeLoraLoaderStack
from .py.seed import RgthreeSeed
from .py.sdxl_empty_latent_image import RgthreeSDXLEmptyLatentImage
from .py.power_prompt import RgthreePowerPrompt
from .py.power_prompt_simple import RgthreePowerPromptSimple
from .py.image_inset_crop import RgthreeImageInsetCrop
from .py.context_big import RgthreeBigContext
from .py.ksampler_config import RgthreeKSamplerConfig
from .py.sdxl_power_prompt_postive import RgthreeSDXLPowerPromptPositive
from .py.sdxl_power_prompt_simple import RgthreeSDXLPowerPromptSimple
from .py.any_switch import RgthreeAnySwitch

NODE_CLASS_MAPPINGS = {
  RgthreeBigContext.NAME: RgthreeBigContext,
  RgthreeContext.NAME: RgthreeContext,
  RgthreeContextSwitch.NAME: RgthreeContextSwitch,
  RgthreeContextSwitchBig.NAME: RgthreeContextSwitchBig,
  RgthreeDisplayInt.NAME: RgthreeDisplayInt,
  RgthreeDisplayAny.NAME: RgthreeDisplayAny,
  RgthreeLoraLoaderStack.NAME: RgthreeLoraLoaderStack,
  RgthreeSeed.NAME: RgthreeSeed,
  RgthreeImageInsetCrop.NAME: RgthreeImageInsetCrop,
  RgthreePowerPrompt.NAME: RgthreePowerPrompt,
  RgthreePowerPromptSimple.NAME: RgthreePowerPromptSimple,
  RgthreeKSamplerConfig.NAME: RgthreeKSamplerConfig,
  RgthreeSDXLEmptyLatentImage.NAME: RgthreeSDXLEmptyLatentImage,
  RgthreeSDXLPowerPromptPositive.NAME: RgthreeSDXLPowerPromptPositive,
  RgthreeSDXLPowerPromptSimple.NAME: RgthreeSDXLPowerPromptSimple,
  RgthreeAnySwitch.NAME: RgthreeAnySwitch,
}


# This doesn't import correctly..
# WEB_DIRECTORY = "./web"

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_DEV_WEB = os.path.abspath(f'{THIS_DIR}/web/')
DIR_PY = os.path.abspath(f'{THIS_DIR}/py')

# remove old directory.
OLD_DIR_WEB = os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree')
if os.path.exists(OLD_DIR_WEB):
  shutil.rmtree(OLD_DIR_WEB)

DIR_WEB = os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree-comfy')
if os.path.exists(DIR_WEB):
  shutil.rmtree(DIR_WEB)
os.makedirs(DIR_WEB)

shutil.copytree(DIR_DEV_WEB, DIR_WEB, dirs_exist_ok=True)


def extend_config(default_config, user_config):
  cfg = {}
  for key, value in default_config.items():
    if key not in user_config:
      cfg[key] = value
    elif isinstance(value, dict):
      cfg[key] = extend_config(value, user_config[key])
    else:
      cfg[key] = user_config[key] if key in user_config else value
  return cfg


with open(os.path.join(DIR_WEB, 'rgthree_config.js'), 'w', encoding = 'UTF-8') as file:
  file.write('export const rgthreeConfig = ' + json.dumps(RGTHREE_CONFIG))

# shutil.copy(os.path.join(THIS_DIR, 'rgthree_config.json'), os.path.join(DIR_WEB, 'rgthree_config.js'))


NOT_NODES = ['constants', 'log', 'utils', 'rgthree']

__all__ = ['NODE_CLASS_MAPPINGS']

nodes = []
for file in glob.glob('*.py', root_dir=DIR_PY) + glob.glob('*.js', root_dir=os.path.join(DIR_DEV_WEB, 'js')):
  name = os.path.splitext(file)[0]
  if name not in nodes and name not in NOT_NODES and not name.startswith(
      '_') and not name.startswith('base') and not 'utils' in name:
    nodes.append(name)

log_welcome(num_nodes=len(nodes))
