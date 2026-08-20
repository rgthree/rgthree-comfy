import os
from aiohttp import web
from server import PromptServer

from ..config import get_config_value
from ..log import log, log_known_message
from .utils_server import set_default_page_resources, set_default_page_routes, get_param
from .routes_config import *
from .routes_model_info import *

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_EXTENSIONS = os.path.abspath(os.path.join(THIS_DIR, '..', '..', '..'))

routes = PromptServer.instance.routes

# Sometimes other pages (link_fixer, etc.) may want to import JS from the comfyui
# directory. To allows TS to resolve like '../comfyui/file.js', we'll also resolve any module HTTP
# to these routes.
set_default_page_resources("comfyui", routes)
set_default_page_resources("common", routes)
set_default_page_resources("lib", routes)

set_default_page_routes("link_fixer", routes)
if get_config_value('unreleased.models_page.enabled') is True:
  set_default_page_routes("models", routes)


@routes.get('/rgthree/api/print')
async def api_print(request):
  """Logs a user message to the terminal."""

  message_type = get_param(request, 'type')
  if log_known_message(message_type) is False:
    log("Unknown log type from api", prefix="rgthree-comfy", color="YELLOW")
  return web.json_response({})


@routes.get('/rgthree/api/incompatible-extensions')
async def api_incompatible_extensions(request):
  """Checks if the extensions folder contains any bad folders known to cause conflict."""
  data = {'extensions': []}
  # There's probably a better way to check, but for now we'll assume we can check the parent
  # directory for the existance of bad folders.
  if os.path.isdir(os.path.join(DIR_EXTENSIONS, 'ComfyUI_Swwan')):
    data['extensions'].append('ComfyUI_Swwan')
  return web.json_response(data)
