"""Optional writable metadata storage, separate from model and node files."""

import hashlib
import os


def get_metadata_directory():
  """Return the opt-in metadata root; leave legacy storage unchanged by default."""
  directory = os.environ.get('RGTHREE_METADATA_DIR')
  if not directory:
    return None
  if not os.path.isabs(directory):
    raise ValueError('RGTHREE_METADATA_DIR must be an absolute path')
  return directory


def get_external_info_path(file_path: str, model_type=None):
  """Use a collision-safe path identity without reading or hashing model weights."""
  directory = get_metadata_directory()
  if directory is None:
    return None
  identity = f'{model_type or ""}\0{os.path.normcase(os.path.abspath(file_path))}'
  key = hashlib.sha256(identity.encode('UTF-8')).hexdigest()
  return os.path.join(directory, 'model-info', f'{key}.json')
