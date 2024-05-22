import os
import json
import re
import copy
import timeit
import asyncio

from datetime import datetime

from .utils import path_exists
from .utils_server import get_param, is_param_falsy
from .utils_info import delete_model_info, get_model_info, set_model_info_partial

from server import PromptServer
from aiohttp import web

import folder_paths

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_WEB = os.path.abspath(f'{THIS_DIR}/../web/')

routes = PromptServer.instance.routes


def set_default_page_resources(path):
  """ Sets up routes for handling static files under a path."""

  @routes.get(f'/rgthree/{path}/{{file}}')
  async def get_resource(request):
    """ Returns a resource file. """
    return web.FileResponse(os.path.join(DIR_WEB, path, request.match_info['file']))

  @routes.get(f'/rgthree/{path}/{{subdir}}/{{file}}')
  async def get_resource_subdir(request):
    """ Returns a resource file. """
    return web.FileResponse(
      os.path.join(DIR_WEB, path, request.match_info['subdir'], request.match_info['file']))


def set_default_page_routes(path):
  """ Sets default path handling for a hosted rgthree page. """

  @routes.get(f'/rgthree/{path}')
  async def get_path_redir(request):
    """ Redirects to the path adding a trailing slash. """
    raise web.HTTPFound(f'{request.path}/')

  @routes.get(f'/rgthree/{path}/')
  async def get_path_index(request):
    """ Handles the page's index loading. """
    html = ''
    with open(os.path.join(DIR_WEB, path, 'index.html'), 'r', encoding='UTF-8') as file:
      html = file.read()
    return web.Response(text=html, content_type='text/html')

  set_default_page_resources(path)


# Sometimes other pages (link_fixer, etc.) may want to import JS from the comfyui
# directory. To allows TS to resolve like '../comfyui/file.js', we'll also resolve any module HTTP
# to these routes.
set_default_page_resources("comfyui")
set_default_page_resources("common")

set_default_page_routes("link_fixer")

# Configuration
from .config import RGTHREE_CONFIG, set_user_config


@routes.get('/rgthree/config.js')
def api_get_user_config_file(request):
  """ Returns the user configuration as a jsavascript file. """
  data_str = json.dumps(RGTHREE_CONFIG, sort_keys=True, indent=2, separators=(",", ": "))
  text = f'export const rgthreeConfig = {data_str}'
  return web.Response(text=text, content_type='application/javascript')


@routes.get('/rgthree/api/config')
def api_get_user_config(request):
  """ Returns the user configuration. """
  return web.json_response(RGTHREE_CONFIG)


@routes.post('/rgthree/api/config')
async def api_set_user_config(request):
  """ Returns the user configuration. """
  post = await request.post()
  data = json.loads(post.get("json"))
  set_user_config(data)
  return web.json_response({"status": "ok"})


# General


@routes.get('/rgthree/api/loras')
async def api_get_loras(request):
  """ Returns a list of loras user configuration. """
  data = folder_paths.get_filename_list("loras")
  return web.json_response(list(data))


@routes.get('/rgthree/api/loras/info')
async def api_get_loras_info(request):
  """ Returns a list loras info; either all or a single if provided a 'file' param. """
  lora_file = get_param(request, 'file')
  maybe_fetch_metadata = lora_file is not None
  if not is_param_falsy(request, 'light'):
    maybe_fetch_metadata = False
  api_response = await get_loras_info_response(request, maybe_fetch_metadata=maybe_fetch_metadata)
  return web.json_response(api_response)


@routes.get('/rgthree/api/loras/info/clear')
async def delete_lora_info(request):
  """Clears lora info from the filesystem for the provided file."""
  api_response = {'status': 200}
  lora_file = get_param(request, 'file')
  del_info = not is_param_falsy(request, 'del_info')
  del_metadata = not is_param_falsy(request, 'del_metadata')
  del_civitai = not is_param_falsy(request, 'del_civitai')
  if lora_file is None:
    api_response['status'] = '404'
    api_response['error'] = 'No Lora file provided'
  elif lora_file == "ALL":  # Force the user to supply file=ALL to trigger all clearing.
    lora_files = folder_paths.get_filename_list("loras")
    for lora_file in lora_files:
      await delete_model_info(lora_file, del_info=del_info, del_metadata=del_metadata, del_civitai=del_civitai)
  else:
    await delete_model_info(lora_file, del_info=del_info, del_metadata=del_metadata, del_civitai=del_civitai)
  return web.json_response(api_response)


@routes.get('/rgthree/api/loras/info/refresh')
async def refresh_get_loras_info(request):
  """ Refreshes lora info; either all or a single if provided a 'file' param. """
  api_response = await get_loras_info_response(request,
                                               maybe_fetch_civitai=True,
                                               maybe_fetch_metadata=True)
  return web.json_response(api_response)


async def get_loras_info_response(request, maybe_fetch_civitai=False, maybe_fetch_metadata=False):
  """Gets lora info for all or a single lora"""
  api_response = {'status': 200}
  lora_file = get_param(request, 'file')
  light = not is_param_falsy(request, 'light')
  if lora_file is not None:
    info_data = await get_model_info(lora_file,
                                     maybe_fetch_civitai=maybe_fetch_civitai,
                                     maybe_fetch_metadata=maybe_fetch_metadata,
                                     light=light)
    if info_data is None:
      api_response['status'] = '404'
      api_response['error'] = 'No Lora found at path'
    else:
      api_response['data'] = info_data
  else:
    api_response['data'] = []
    lora_files = folder_paths.get_filename_list("loras")
    for lora_file in lora_files:
      info_data = await get_model_info(lora_file,
                                       maybe_fetch_civitai=maybe_fetch_civitai,
                                       maybe_fetch_metadata=maybe_fetch_metadata,
                                       light=light)
      api_response['data'].append(info_data)
  return api_response


@routes.post('/rgthree/api/loras/info')
async def api_save_lora_data(request):
  """Saves data to a lora by name. """
  api_response = {'status': 200}
  lora_file = get_param(request, 'file')
  if lora_file is None:
    api_response['status'] = '404'
    api_response['error'] = 'No Lora found at path'
  else:
    post = await request.post()
    await set_model_info_partial(lora_file, json.loads(post.get("json")))
    info_data = await get_model_info(lora_file)
    api_response['data'] = info_data
  return web.json_response(api_response)


@routes.get('/rgthree/api/loras/img')
async def api_get_loras_info_img(request):
  """ Returns an image response if one exists for the lora. """
  lora_file = get_param(request, 'file')
  lora_path = folder_paths.get_full_path("loras", lora_file)
  if not path_exists(lora_path):
    lora_path = os.path.abspath(lora_path)

  img_path = None
  for ext in ['jpg', 'png', 'jpeg']:
    try_path = f'{os.path.splitext(lora_path)[0]}.{ext}'
    if path_exists(try_path):
      img_path = try_path
      break

  if not path_exists(img_path):
    api_response = {}
    api_response['status'] = '404'
    api_response['error'] = 'No Lora found at path'
    return web.json_response(api_response)

  return web.FileResponse(img_path)
