import os
from aiohttp import web
from server import PromptServer

from ..config import get_config_value
from ..log import log
from .utils_server import set_default_page_resources, set_default_page_routes, get_param
from .routes_config import *
from .routes_model_info import *

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_WEB = os.path.abspath(f'{THIS_DIR}/../../web/')

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
  if message_type == 'PRIMITIVE_REROUTE':
    log(
      "You are using rgthree-comfy reroutes with a ComfyUI Primitive node. Unfortunately, ComfyUI "
      "has removed support for this. While rgthree-comfy has a best-effort support fallback for "
      "now, it may no longer work as expected and is strongly recommended you either replace the "
      "Reroute node using ComfyUI's reroute node, or refrain from using the Primitive node "
      "(you can always use the rgthree-comfy \"Power Primitive\" for non-combo primitives).",
      prefix="Reroute",
      color="YELLOW",
      id=message_type,
      at_most_secs=20
    )
  else:
    log("Unknown log type from api", prefix="rgthree-comfy",color ="YELLOW")

  return web.json_response({})
