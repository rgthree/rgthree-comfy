#!/usr/bin/env python3

import subprocess
import os
import shutil
import glob
import json

from config import RGTHREE_CONFIG

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_WEB = os.path.abspath(f'{THIS_DIR}/web/')
DIR_WEB_COMFYUI = os.path.abspath(f'{DIR_WEB}/comfyui/')

js_files = glob.glob(os.path.join(THIS_DIR, 'web/**/*.js'))
for file in js_files:
  os.remove(file)

subprocess.run(["./node_modules/typescript/bin/tsc"])

with open(os.path.join(DIR_WEB_COMFYUI, 'rgthree_config.js'), 'w', encoding = 'UTF-8') as file:
  file.write('export const rgthreeConfig = ' + json.dumps(RGTHREE_CONFIG))
