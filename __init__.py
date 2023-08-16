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


NODE_CLASS_MAPPINGS = {
    RgthreeContext.NAME: RgthreeContext,
    RgthreeContextSwitch.NAME: RgthreeContextSwitch,
    RgthreeDisplayInt.NAME: RgthreeDisplayInt,
    RgthreeLoraLoaderStack.NAME: RgthreeLoraLoaderStack,
    RgthreeSeed.NAME: RgthreeSeed
}

def get_dir(subpath, mkdir=False):
    dir = os.path.dirname(inspect.getfile(PromptServer))
    dir = os.path.join(dir, subpath)
    dir = os.path.abspath(dir)
    if not os.path.exists(dir):
        if mkdir:
            os.makedirs(dir)
        else:
            raise ValueError('Path not found: %s' % dir)
    return dir

DIR_JS = get_dir('custom_nodes/rgthree-comfy/js')
DIR_PY = get_dir('custom_nodes/rgthree-comfy/py')
DIR_WEB = get_dir('web/extensions/rgthree', mkdir=True)

shutil.copytree(DIR_JS, DIR_WEB, dirs_exist_ok=True)

nodes=[]
not_nodes=['constants','log','utils']

for file in glob.glob('*.py', root_dir=DIR_PY) + glob.glob('*.js', root_dir=DIR_JS):
    name = os.path.splitext(file)[0]
    if name not in nodes and name not in not_nodes and not name.startswith('_'):
        nodes.append(name)

log_welcome(num_nodes=len(nodes))

__all__ = ['NODE_CLASS_MAPPINGS']
