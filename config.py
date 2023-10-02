import os
import json
import re

def extend_config(default_config, user_config):
  cfg = {}
  for key, value in default_config.items():
    if key not in user_config:
      cfg[key] = value
    elif isinstance(value, dict):
      cfg[key] = extend_config(value, user_config[key])
    else:
      cfg[key] = user_config[key] if key in user_config else value
  return cfg

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG_FILE = os.path.join(THIS_DIR, 'rgthree_config.json.default')
with open(DEFAULT_CONFIG_FILE, 'r', encoding = 'UTF-8') as file:
  config = re.sub(r"(?:^|\s)//.*", "", file.read(), flags=re.MULTILINE)
  rgthree_config_default = json.loads(config)

CONFIG_FILE = os.path.join(THIS_DIR, 'rgthree_config.json')
if os.path.exists(CONFIG_FILE):
  with open(CONFIG_FILE, 'r', encoding = 'UTF-8') as file:
    config = re.sub(r"(?:^|\s)//.*", "", file.read(), flags=re.MULTILINE)
    rgthree_config_user = json.loads(config)
else:
  rgthree_config_user = {}

RGTHREE_CONFIG = extend_config(rgthree_config_default, rgthree_config_user)
