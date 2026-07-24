#!/usr/bin/env python3

# A nicer output for git pulling custom nodes (and ComfyUI).
# Quick shell version: ls | xargs -I % sh -c 'echo; echo %; git -C % pull'

import os
from subprocess import Popen, PIPE, STDOUT

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(THIS_DIR)
os.chdir("../")


def pull_path(path, origin=None, print_col_max=15, silent=False):
  if not silent and path != '../':
    print(f"🗀  {path:.<{print_col_max}}", end='')

  # Try the pull
  args = ["git", "-C", path, "pull"]
  if origin is not None:
    args.append('origin')
    args.append(origin)
  output, _error = Popen(args, stdout=PIPE, stderr=STDOUT).communicate()
  output = output.decode()
  if 'Already up to date' in output:
    if not silent:
      print(' \33[32m🗸 Already up to date\33[0m')
    return (True, output,)

  if output.startswith('error:') and 'local changes to the following files' in output:
    if not silent:
      print(f' \33[31m🞫 Error: Needs Restore\33[0m \n {output}')
    p = Popen(["git", "-C", path, "restore", "."], stdout=PIPE, stderr=STDOUT)
    _output, _error = p.communicate()
    success, i_output = pull_path(path, origin=origin, print_col_max=print_col_max, silent=True)
    if not silent:
      print(f"   {'':.<{print_col_max}}", end='')
    if success:
      if not silent:
        print(' \33[32m🗸 Updated\33[0m')
      return (True, i_output,)
    else:
      if not silent:
        print(f' \33[31m🞫 Unknown Error\33[0m \n {i_output}')
      return (False, i_output,)

  if 'You are not currently on a branch' in output:
    if not silent:
      print(' \33[31m🞫 Error: Needs Branch\33[0m')
      print(f"   {'':.<{print_col_max}} \33[33m🡅 Trying main.\33[0m")
    m_success, m_output = pull_path(path, origin='main', print_col_max=print_col_max, silent=True)
    if not m_success and 'fatal: couldn\'t find remote ref main' in m_output:
      if not silent:
        print(f"   {'':.<{print_col_max}} \33[31m🞫 Error: No main\33[0m")
        print(f"   {'':.<{print_col_max}} \33[33m🡅 Trying master.\33[0m")
    m_success, m_output = pull_path(path, origin='master', print_col_max=print_col_max, silent=True)
    if m_success:
      if not silent:
        print(f"   {'':.<{print_col_max}} \33[32m🗸 Updated\33[0m")
      return (True, m_output,)
    else:
      if not silent:
        print(f"   {'':.<{print_col_max}} \33[31m🞫 Error: No master\33[0m")
      return (False, m_output,)

  if not silent:
    print(f' \33[33m🡅 Needs update.\33[0m \n {output}', end='')
  return (False, output,)


# Get the list or custom nodes, so we can format the output a little more nicely.
custom_extensions = []
custom_extensions_name_max = 0
for directory in os.listdir(os.getcwd()):
  if os.path.isdir(directory) and directory != "__pycache__":  #and directory != "rgthree-comfy" :
    custom_extensions.append({'directory': directory})
    if len(directory) > custom_extensions_name_max:
      custom_extensions_name_max = len(directory)

if len(custom_extensions) == 0:
  custom_extensions_name_max = 15
else:
  custom_extensions_name_max += 6

# Update ComfyUI itself.
print(f"{'Updating ComfyUI ':.<{custom_extensions_name_max}}", end='')
pull_path('../', origin='master')

# If we have custom nodes, update them as well.
if len(custom_extensions) > 0:
  print(f'\nUpdating custom_nodes ({len(custom_extensions)}):')
  for custom_extension in custom_extensions:
    directory = custom_extension['directory']
    if 'rgthree' in directory or directory.startswith('__'):
      continue
    pull_path(directory, print_col_max=custom_extensions_name_max)
