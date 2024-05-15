import hashlib
import requests
import json
import torch
import re
import os
import copy

from datetime import datetime

from .utils import get_dict_value, is_dict_value_falsy, load_json_file, save_json_file
from .utils_userdata import read_userdata_json, save_userdata_json

import folder_paths
from server import PromptServer


async def get_model_info(file: str,
                         model_type="loras",
                         default=None,
                         maybe_fetch_civitai=False,
                         force_fetch_civitai=False):

  file_path = folder_paths.get_full_path(model_type, file)
  if not os.path.exists(file_path):
    file_path = os.path.abspath(file_path)
  if not os.path.exists(file_path):
    return default

  info_data = {}
  should_save = False
  # Try to load a rgthree-info.json file next to the file.
  try_info_path = f'{file_path}.rgthree-info.json'
  if os.path.exists(try_info_path):
    info_data = load_json_file(try_info_path)

  if 'file' not in info_data:
    info_data['file'] = file
    should_save = True
  if 'path' not in info_data:
    info_data['path'] = file_path
    should_save = True

  # Check if we have an image next to the file and, if so, add it to the front of the images
  # (if it isn't already).
  img_next_to_file = None
  for ext in ['jpg', 'png', 'jpeg']:
    try_path = f'{os.path.splitext(file_path)[0]}.{ext}'
    if os.path.exists(try_path):
      img_next_to_file = try_path
      break

  if 'images' not in info_data:
    info_data['images'] = []
    should_save = True

  if img_next_to_file:
    img_next_to_file_url = f'/rgthree/api/loras/img?file={file}'
    if len(info_data['images']) == 0 or info_data['images'][0]['url'] != img_next_to_file_url:
      info_data['images'].insert(0, {'url': img_next_to_file_url})
      should_save = True

  if 'raw' not in info_data:
    info_data['raw'] = {}
    should_save = True

  if force_fetch_civitai is True or (maybe_fetch_civitai is True and
                                     'civitai' not in info_data['raw']):
    data_civitai = get_model_civitai_data(file,
                                          model_type=model_type,
                                          default={},
                                          refresh=force_fetch_civitai)

    if 'name' not in info_data:
      info_data['name'] = get_dict_value(data_civitai, 'model.name', '')
      should_save = True
      version_name = get_dict_value(data_civitai, 'name')
      if version_name is not None:
        info_data['name'] += f' - {version_name}'

    if 'type' not in info_data:
      info_data['type'] = get_dict_value(data_civitai, 'model.type')
      should_save = True
    if 'baseModel' not in info_data:
      info_data['baseModel'] = get_dict_value(data_civitai, 'baseModel')
      should_save = True

    if 'triggerWords' not in info_data:
      if 'triggerWords' in data_civitai:
        info_data['triggerWords'] = get_dict_value(data_civitai, 'triggerWords')
        should_save = True
      if is_dict_value_falsy(data_civitai, 'triggerWords') and 'trainedWords' in data_civitai:
        info_data['triggerWords'] = get_dict_value(data_civitai, 'trainedWords')
      if not is_dict_value_falsy(data_civitai,
                                 'triggerWords') and ',' in info_data['triggerWords'][0]:
        trigger_words = re.sub(r"^,", "", info_data['triggerWords'][0])
        trigger_words = re.sub(r",$", "", trigger_words)
        trigger_words = re.sub(r"\s*,\s*", ",", trigger_words)
        info_data['triggerWords'] = trigger_words.split(',')
        should_save = True

    if 'sha256' not in info_data:
      info_data['sha256'] = data_civitai['_sha256']
      should_save = True

    if 'modelId' in data_civitai:
      info_data['links'] = info_data['links'] if 'links' in info_data else []
      civitai_link = f'https://civitai.com/models/{get_dict_value(data_civitai, "modelId")}'
      if get_dict_value(data_civitai, "id"):
        civitai_link += f'?modelVersionId={get_dict_value(data_civitai, "id")}'
      info_data['links'].append(civitai_link)
      info_data['links'].append(data_civitai['_civitai_api'])
      should_save = True

    # Take images from civitai
    if 'images' in data_civitai:
      info_data_image_urls = list(
        map(lambda i: i['url'] if 'url' in i else None, info_data['images']))
      for img in data_civitai['images']:
        img_url = get_dict_value(img, 'url')
        if img_url is not None and img_url not in info_data_image_urls:
          img_id = os.path.splitext(os.path.basename(img_url))[0] if img_url is not None else None
          img_data = {
            'url': img_url,
            'civitaiUrl': f'https://civitai.com/images/{img_id}' if img_id is not None else None,
            'width': get_dict_value(img, 'width'),
            'height': get_dict_value(img, 'height'),
            'type': get_dict_value(img, 'type'),
            'nsfwLevel': get_dict_value(img, 'nsfwLevel'),
            'seed': get_dict_value(img, 'meta.seed'),
            'positive': get_dict_value(img, 'meta.prompt'),
            'negative': get_dict_value(img, 'meta.negativePrompt'),
            'steps': get_dict_value(img, 'meta.steps'),
            'sampler': get_dict_value(img, 'meta.sampler'),
            'cfg': get_dict_value(img, 'meta.cfgScale'),
            'model': get_dict_value(img, 'meta.Model'),
            'resources': get_dict_value(img, 'meta.resources'),
          }
          info_data['images'].append(img_data)
          should_save = True

    # The raw data
    if 'civitai' not in info_data['raw']:
      info_data['raw']['civitai'] = data_civitai
      should_save = True

  else:
    if 'sha256' not in info_data:
      file_hash = get_sha256_hash(file_path)
      if file_hash is not None:
        info_data['sha256'] = file_hash
        should_save = True

  # If we've fetched civitai, then the UI is likely waiting to see if the refreshed data is coming
  # in. Not needed yet, only for Lora Chooser.
  # await PromptServer.instance.send("rgthree-lora-info", {"data": info_data})

  if should_save:
    save_model_info(file, info_data, model_type=model_type)
  return info_data


def get_sha256_hash(path: str):
  """Returns the hash for the file."""
  file_hash = None
  sha256_hash = hashlib.sha256()
  with open(path, "rb") as f:
    # Read and update hash string value in blocks of 4K
    for byte_block in iter(lambda: f.read(4096), b""):
      sha256_hash.update(byte_block)
    file_hash = sha256_hash.hexdigest()
  return file_hash


def get_model_civitai_data(file: str, model_type="loras", default=None, refresh=False):
  """Gets the civitai data, either cached from the user directory, or from civitai api."""
  file_path = folder_paths.get_full_path(model_type, file)
  if not os.path.exists(file_path):
    file_path = os.path.abspath(file_path)

  file_hash = get_sha256_hash(file_path)
  if file_hash is None:
    return None

  api_url = f'https://civitai.com/api/v1/model-versions/by-hash/{file_hash}'
  file_data = read_userdata_json(f'info/{file_hash}_civitai.json')
  if file_data is None or refresh == True:
    try:
      response = requests.get(api_url, timeout=5000)
      data = response.json()
      save_userdata_json(f'civitai/{file_hash}.json', {
        'url': api_url,
        'timestamp': datetime.now().timestamp(),
        'response': data
      })
      file_data = read_userdata_json(f'civitai/{file_hash}.json')
    except requests.exceptions.RequestException as e:  # This is the correct syntax
      print(e)
  response = file_data['response'] if file_data is not None and 'response' in file_data else None
  if response is not None:
    response['_sha256'] = file_hash
    response['_civitai_api'] = api_url
  return response if response is not None else default


async def set_model_info_partial(file: str, info_data_partial, model_type="loras"):
  """Sets partial data into the existing model info data."""
  info_data = await get_model_info(file, model_type=model_type, default={})
  info_data = {**info_data, **info_data_partial}
  save_model_info(file, info_data, model_type=model_type)


def save_model_info(file: str, info_data, model_type="loras"):
  """Saves the model info alongside the model itself."""
  file_path = folder_paths.get_full_path(model_type, file)
  if not os.path.exists(file_path):
    file_path = os.path.abspath(file_path)
  try_info_path = f'{file_path}.rgthree-info.json'
  save_json_file(try_info_path, info_data)
