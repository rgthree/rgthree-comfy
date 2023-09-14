import subprocess
import os
import shutil

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_DEV_JS=os.path.abspath(f'{THIS_DIR}/js')
DIR_WEB_JS=os.path.abspath(f'{THIS_DIR}/../../web/extensions/rgthree')

if os.path.exists(DIR_DEV_JS):
  shutil.rmtree(DIR_DEV_JS)

subprocess.run(["./node_modules/typescript/bin/tsc"])

if os.path.exists(DIR_WEB_JS):
  shutil.rmtree(DIR_WEB_JS)
shutil.copytree(DIR_DEV_JS, DIR_WEB_JS, dirs_exist_ok=True)