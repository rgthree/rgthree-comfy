import subprocess
import os
import shutil
import glob
import json

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_DEV=os.path.abspath(f'{THIS_DIR}/web')
DIR_WEB=os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree-comfy')

js_files = glob.glob(os.path.join(THIS_DIR, 'web/**/*.js'))
for file in js_files:
  os.remove(file)

subprocess.run(["./node_modules/typescript/bin/tsc"])


if os.path.exists(DIR_WEB):
  shutil.rmtree(DIR_WEB)
shutil.copytree(DIR_DEV, DIR_WEB, dirs_exist_ok=True)

CONFIG_FILE = os.path.join(THIS_DIR, 'rgthree_config.json')
with open(CONFIG_FILE, 'r', encoding = 'UTF-8') as file:
  rgthree_config = json.load(file)

with open(os.path.join(DIR_WEB, 'rgthree_config.js'), 'w', encoding = 'UTF-8') as file:
  file.write('export const rgthreeConfig = ' + json.dumps(rgthree_config))
