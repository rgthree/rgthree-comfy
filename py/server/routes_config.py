import json
from aiohttp import web

from server import PromptServer

from .utils_server import is_param_truthy
from ..config import get_config, set_user_config, refresh_config

routes = PromptServer.instance.routes

@routes.get('/rgthree/config.js')
def api_get_user_config_file(request):
  """ Returns the user configuration as a jsavascript file. """
  data_str = json.dumps(get_config(), sort_keys=True, indent=2, separators=(",", ": "))
  text = f'export const rgthreeConfig = {data_str}'
  return web.Response(text=text, content_type='application/javascript')


@routes.get('/rgthree/api/config')
def api_get_user_config(request):
  """ Returns the user configuration. """
  if is_param_truthy(request, 'refresh'):
    refresh_config()
  return web.json_response(get_config())


@routes.post('/rgthree/api/config')
async def api_set_user_config(request):
  """ Returns the user configuration. """
  post = await request.post()
  data = json.loads(post.get("json"))
  set_user_config(data)
  return web.json_response({"status": "ok"})