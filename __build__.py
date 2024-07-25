#!/usr/bin/env python3

import subprocess
import os
from shutil import rmtree, copytree, ignore_patterns
from glob import glob
import time
import re
import argparse

from py.log import COLORS
from py.config import RGTHREE_CONFIG

start = time.time()

parser = argparse.ArgumentParser()
parser.add_argument("-t", "--with-tests", default=False, action="store_true")
args = parser.parse_args()

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_SRC_WEB = os.path.abspath(f'{THIS_DIR}/src_web/')
DIR_WEB = os.path.abspath(f'{THIS_DIR}/web/')
DIR_WEB_COMFYUI = os.path.abspath(f'{DIR_WEB}/comfyui/')


def log_step(msg=None, status=None):
  """ Logs a step keeping track of timing and initial msg. """
  global step_msg  # pylint: disable=W0601
  global step_start  # pylint: disable=W0601
  if msg:
    tag=f'{COLORS["YELLOW"]}[ Notice ]' if status == 'Notice' else f'{COLORS["RESET"]}[Starting]'
    step_msg = f'▻ {tag}{COLORS["RESET"]} {msg}...'
    step_start = time.time()
    print(step_msg, end="\r")
  elif status:
    step_time = round(time.time() - step_start, 3)
    if status == 'Error':
      status_msg=f'{COLORS["RED"]}⤫ {status}{COLORS["RESET"]}'
    else:
      status_msg=f'{COLORS["BRIGHT_GREEN"]}🗸 {status}{COLORS["RESET"]}'
    print(f'{step_msg.ljust(64, ".")} {status_msg} ({step_time}s)')


log_step(msg='Copying web directory')
rmtree(DIR_WEB)
copytree(DIR_SRC_WEB, DIR_WEB, ignore=ignore_patterns("typings*", "*.ts", "*.scss"))
log_step(status="Done")

log_step(msg='TypeScript')
checked = subprocess.run(["node", "./node_modules/typescript/bin/tsc"], check=True)
log_step(status="Done")

if args.with_tests:
  log_step(msg='Removing directories (KEEPING TESTING)', status="Notice")
else:
  log_step(msg='Removing uneeded directories')
  test_path=os.path.join(DIR_WEB, 'comfyui', 'tests')
  if os.path.exists(test_path):
    rmtree(test_path)
  rmtree(os.path.join(DIR_WEB, 'comfyui', 'testing'))
# Always remove the dummy scripts_comfy directory
rmtree(os.path.join(DIR_WEB, 'scripts_comfy'))
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
js_files = glob(os.path.join(DIR_WEB, '**', '*.js'), recursive=True)
for file in js_files:
  rel_path = file.replace(f'{DIR_WEB}/', "")
  with open(file, 'r', encoding="utf-8") as f:
    filedata = f.read()
  num = rel_path.count(os.sep)
  if rel_path.startswith('comfyui'):
    filedata = re.sub(r'(from\s+["\'])rgthree/', f'\\1{"../" * (num + 1)}rgthree/', filedata)
    filedata = re.sub(r'(from\s+["\'])scripts/', f'\\1{"../" * (num + 1)}scripts/', filedata)
  else:
    filedata = re.sub(r'(from\s+["\'])rgthree/', f'\\1{"../" * num}', filedata)
  with open(file, 'w', encoding="utf-8") as f:
    f.write(filedata)
log_step(status="Done")

print(f'Finished all in {round(time.time() - start, 3)}s')
