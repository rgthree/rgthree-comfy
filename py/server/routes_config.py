import json
import re
from aiohttp import web

from server import PromptServer

from ..pyproject import get_logo_svg
from .utils_server import is_param_truthy, get_param
from ..config import get_config, set_user_config, refresh_config

routes = PromptServer.instance.routes


@routes.get('/rgthree/config.js')
def api_get_user_config_file(request):
  """ Returns the user configuration as a javascript file. """
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


@routes.get('/rgthree/logo.svg')
async def get_logo(request, as_markup=False):
  """ Returns the rgthree logo with color config. """
  bg = get_param(request, 'bg', 'transparent')
  fg = get_param(request, 'fg', '#111111')
  w = get_param(request, 'w')
  h = get_param(request, 'h')
  css_class = get_param(request, 'cssClass')
  svg = await get_logo_svg()
  resp = svg.format(bg=bg, fg=fg)
  if w is not None:
    resp = re.sub(r'(<svg[^\>]*?)width="[^\"]+"', r'\1', resp)
    if str(w).isnumeric():
      resp = re.sub(r'<svg', f'<svg width="{w}"', resp)
  if h is not None:
    resp = re.sub(r'(<svg[^\>]*?)height="[^\"]+"', r'\1', resp)
    if str(h).isnumeric():
      resp = re.sub(r'<svg', f'<svg height="{h}"', resp)
  if css_class is not None:
    resp = re.sub(r'<svg', f'<svg class="{css_class}"', resp)
  if as_markup:
    resp = re.sub(r'^.*?<svg', r'<svg', resp, flags=re.DOTALL)
  return web.Response(text=resp, content_type='image/svg+xml')


@routes.get('/rgthree/logo_markup.svg')
async def get_logo_markup(request):
  """ Returns the rgthree logo svg markup (no doctype) with options. """
  return await get_logo(request, as_markup=True)
