#!/usr/bin/env python3

import subprocess
import os
from shutil import rmtree, copytree, ignore_patterns
from glob import glob
import time
import re

from py.log import COLORS
from py.config import RGTHREE_CONFIG

start = time.time()

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_SRC_WEB = os.path.abspath(f'{THIS_DIR}/src_web/')
DIR_WEB = os.path.abspath(f'{THIS_DIR}/web/')
DIR_WEB_COMFYUI = os.path.abspath(f'{DIR_WEB}/comfyui/')

rmtree(DIR_WEB)


def log_step(msg=None, status=None):
  """ Logs a step keeping track of timing and initial msg. """
  global step_msg  # pylint: disable=W0601
  global step_start  # pylint: disable=W0601
  if msg:
    step_msg = f'▻ [Starting] {msg}...'
    step_start = time.time()
    print(step_msg, end="\r")
  elif status:
    step_time = round(time.time() - step_start, 3)
    if status == 'Error':
      status_msg=f'{COLORS["RED"]}⤫ {status}{COLORS["RESET"]}'
    else:
      status_msg=f'{COLORS["BRIGHT_GREEN"]}🗸 {status}{COLORS["RESET"]}'
    print(
      f'{step_msg.ljust(50, ".")} {COLORS["BRIGHT_GREEN"]}🗸 {status}{COLORS["RESET"]} ({step_time}s)'
    )


log_step(msg='Copying web directory')
copytree(DIR_SRC_WEB, DIR_WEB, ignore=ignore_patterns("typings*", "*.ts", "*.scss"))
log_step(status="Done")

log_step(msg='TypeScript')
checked = subprocess.run(["./node_modules/typescript/bin/tsc"], check=True)
log_step(status="Done")

scsss = glob(os.path.join(DIR_SRC_WEB, "**", "*.scss"), recursive=True)
log_step(msg=f'SASS for {len(scsss)} files')
scsss = [i.replace(THIS_DIR, '.') for i in scsss]
cmds = ["node", "./node_modules/sass/sass"]
for scss in scsss:
  out = scss.replace('src_web', 'web').replace('.scss', '.css')
  cmds.append(f'{scss}:{out}')
cmds.append('--no-source-map')
checked = subprocess.run(cmds, check=True)
log_step(status="Done")

# Handle the common directories. Because ComfyUI loads under /extensions/rgthree-comfy we can't
# easily share sources outside of the `DIR_WEB_COMFYUI` _and_ allow typescript to resolve them in
# src view, so we set the path in the tsconfig to map an import of "rgthree/common" to the
# "src_web/common" directory, but then need to rewrite the comfyui JS files to load from
# "../../rgthree/common" (which we map correctly in rgthree_server.py).
log_step(msg='Cleaning Imports')
print('▻ [Starting] Cleaning Imports...', end="\r")
web_subfolders = [f.name for f in os.scandir(DIR_WEB) if f.is_dir()]
for subfolder in web_subfolders:
  js_files = glob(os.path.join(DIR_WEB, subfolder, '*.js'), recursive=True)
  for file in js_files:
    with open(file, 'r', encoding="utf-8") as f:
      filedata = f.read()
    if subfolder == 'comfyui':
      filedata = re.sub(r'(from\s+["\'])rgthree/', '\\1../../rgthree/', filedata)
    else:
      filedata = re.sub(r'(from\s+["\'])rgthree/', '\\1../', filedata)
    with open(file, 'w', encoding="utf-8") as f:
      f.write(filedata)
log_step(status="Done")

print(f'Finished all in {round(time.time() - start, 3)}s')
