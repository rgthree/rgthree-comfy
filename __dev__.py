import subprocess
import os
import shutil
import glob

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_DEV=os.path.abspath(f'{THIS_DIR}/web')
DIR_WEB=os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree-comfy')

js_files = glob.glob(os.path.join(THIS_DIR, '*.js'))
for file in js_files:
  os.remove(file)

subprocess.run(["./node_modules/typescript/bin/tsc"])

if os.path.exists(DIR_WEB):
  shutil.rmtree(DIR_WEB)
shutil.copytree(DIR_DEV, DIR_WEB, dirs_exist_ok=True)