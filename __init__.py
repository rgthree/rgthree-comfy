from server import PromptServer
import importlib.util
import glob
import os
import sys
import shutil
import inspect


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

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

for file in glob.glob("*.py", root_dir=DIR_PY, recursive=False):
    name = os.path.splitext(file)[0]
    spec = importlib.util.spec_from_file_location(name, os.path.join(DIR_PY, file))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    if hasattr(module, "NODE_CLASS_MAPPINGS") and getattr(module, "NODE_CLASS_MAPPINGS") is not None:
        NODE_CLASS_MAPPINGS.update(module.NODE_CLASS_MAPPINGS)
        if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS") and getattr(module, "NODE_DISPLAY_NAME_MAPPINGS") is not None:
            NODE_DISPLAY_NAME_MAPPINGS.update(module.NODE_DISPLAY_NAME_MAPPINGS)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
