#!/usr/bin/env python3

import subprocess
import os
from shutil import rmtree, copytree, ignore_patterns
from glob import glob
import json
import re

from config import RGTHREE_CONFIG

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_SRC_WEB = os.path.abspath(f'{THIS_DIR}/src_web/')
DIR_WEB = os.path.abspath(f'{THIS_DIR}/web/')
DIR_WEB_COMFYUI = os.path.abspath(f'{DIR_WEB}/comfyui/')


rmtree(DIR_WEB)

copytree(DIR_SRC_WEB, DIR_WEB, ignore=ignore_patterns("typings*", "*.ts"))

subprocess.run(["./node_modules/typescript/bin/tsc"])

with open(os.path.join(DIR_WEB_COMFYUI, 'rgthree_config.js'), 'w', encoding = 'UTF-8') as file:
  file.write('export const rgthreeConfig = ' + json.dumps(RGTHREE_CONFIG))

# Because ComfyUI loads under /extensions/rgthree-comfy we can't easily share sources outside of the
# DIR_WEB_COMFYUI _and_ allow typescript to resolve them, so we set the path in the tsconfig to map
# an import of "rgthree/common" to the "src_web/common" directory, but then need to rewrite the
# comfyui JS files to load from "../../rgthree/common" (which we map correctly in
# rgthree_server.py).
# We only need to do this for the DIR_WEB_COMFYUI, as the other directories already load with fine
# relative paths.
js_files = glob(os.path.join(DIR_WEB_COMFYUI, '*.js'))
for file in js_files:
  with open(file, 'r', encoding = "utf-8") as f:
    filedata = f.read()
  filedata = re.sub(r'(from\s+["\'])rgthree/', '\\1../../rgthree/', filedata)
  with open(file, 'w', encoding = "utf-8") as f:
    f.write(filedata)
