import os

from .utils import load_json_file, path_exists, save_json_file

THIS_DIR = os.path.dirname(os.path.abspath(__file__))

# Resolve ComfyUI's standard user directory (e.g., ComfyUI/user)
try:
  import folder_paths  # Provided by ComfyUI
  base_path = getattr(folder_paths, 'base_path', None)
  if not base_path:
    # Derive base from module location if attribute missing
    base_path = os.path.abspath(os.path.join(os.path.dirname(folder_paths.__file__), '..'))
  USERDATA = os.path.join(base_path, 'user')
except Exception:
  # Fallback: navigate up to ComfyUI root from this file: custom_nodes/rgthree-comfy/py -> ../../..
  USERDATA = os.path.abspath(os.path.join(THIS_DIR, '..', '..', '..', 'user'))


def read_userdata_file(rel_path: str):
  """Reads a file from the userdata directory."""
  file_path = clean_path(rel_path)
  if path_exists(file_path):
    with open(file_path, 'r', encoding='UTF-8') as file:
      return file.read()
  return None


def save_userdata_file(rel_path: str, content: str):
  """Saves a file from the userdata directory."""
  file_path = clean_path(rel_path)
  with open(file_path, 'w+', encoding='UTF-8') as file:
    file.write(content)


def delete_userdata_file(rel_path: str):
  """Deletes a file from the userdata directory."""
  file_path = clean_path(rel_path)
  if os.path.isfile(file_path):
    os.remove(file_path)


def read_userdata_json(rel_path: str):
  """Reads a json file from the userdata directory."""
  file_path = clean_path(rel_path)
  return load_json_file(file_path)


def save_userdata_json(rel_path: str, data: dict):
  """Saves a json file from the userdata directory."""
  file_path = clean_path(rel_path)
  return save_json_file(file_path, data)


def clean_path(rel_path: str):
  """Cleans a relative path by splitting on forward slash and os.path.joining."""
  cleaned = USERDATA
  paths = rel_path.split('/')
  for path in paths:
    cleaned = os.path.join(cleaned, path)
  return cleaned
