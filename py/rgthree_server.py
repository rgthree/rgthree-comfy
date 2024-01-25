from server import PromptServer
from aiohttp import web

import comfy.samplers
import folder_paths

import os
import time
import json

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
  text=f'export const rgthreeConfig = {json.dumps(RGTHREE_CONFIG, sort_keys=True, indent=2, separators=(",", ": "))}'
  return web.Response(text=text, content_type='application/javascript')


@routes.get('/rgthree/api/config')
def api_get_user_config(request):
  """ Returns the user configuration. """
  return web.json_response(json.dumps(RGTHREE_CONFIG))

@routes.post('/rgthree/api/config')
async def api_set_user_config(request):
  """ Returns the user configuration. """
  post = await request.post()
  data = json.loads(post.get("json"))
  set_user_config(data)
  return web.json_response({"status": "ok"})
