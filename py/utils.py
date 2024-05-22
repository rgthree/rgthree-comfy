import json
import os
import re


class AnyType(str):
  """A special class that is always equal in not equal comparisons. Credit to pythongosssss"""

  def __ne__(self, __value: object) -> bool:
    return False


class ContainsAnyDict(dict):
  """A special class that always returns true for contains check ('prop' in my_dict)."""

  def __contains__(self, key):
    return True


any_type = AnyType("*")


def is_dict_value_falsy(data: dict, dict_key: str):
  """ Checks if a dict value is falsy."""
  val = get_dict_value(data, dict_key)
  return not val


def get_dict_value(data: dict, dict_key: str, default=None):
  """ Gets a deeply nested value given a dot-delimited key."""
  keys = dict_key.split('.')
  key = keys.pop(0) if len(keys) > 0 else None
  found = data[key] if key in data else None
  if found is not None and len(keys) > 0:
    return get_dict_value(found, '.'.join(keys), default)
  return found if found is not None else default


def set_dict_value(data: dict, dict_key: str, value, create_missing_objects=True):
  """ Sets a deeply nested value given a dot-delimited key."""
  keys = dict_key.split('.')
  key = keys.pop(0) if len(keys) > 0 else None
  if key not in data:
    if create_missing_objects == False:
      return
    data[key] = {}
  if len(keys) == 0:
    data[key] = value
  else:
    set_dict_value(data[key], '.'.join(keys), value, create_missing_objects)

  return data


def dict_has_key(data: dict, dict_key):
  """ Checks if a dict has a deeply nested dot-delimited key."""
  keys = dict_key.split('.')
  key = keys.pop(0) if len(keys) > 0 else None
  if key is None or key not in data:
    return False
  if len(keys) == 0:
    return True
  return dict_has_key(data[key], '.'.join(keys))


def load_json_file(file: str, default=None):
  """Reads a json file and returns the json dict, stripping out "//" comments first."""
  if path_exists(file):
    with open(file, 'r', encoding='UTF-8') as file:
      config = re.sub(r"(?:^|\s)//.*", "", file.read(), flags=re.MULTILINE)
    return json.loads(config)
  return default


def save_json_file(file_path: str, data: dict):
  """Saves a json file."""
  os.makedirs(os.path.dirname(file_path), exist_ok=True)
  with open(file_path, 'w+', encoding='UTF-8') as file:
    json.dump(data, file, sort_keys=False, indent=2, separators=(",", ": "))

def path_exists(path):
  """Checks if a path exists, accepting None type."""
  if path is not None:
    return os.path.exists(path)
  return False
