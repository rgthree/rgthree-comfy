import time
from aiohttp import web

from server import PromptServer

from .utils_server import get_param
from ..utils_userdata import read_userdata_json, save_userdata_json

routes = PromptServer.instance.routes

TEMPLATES_PATH = 'power_lora/templates.json'


def _load_templates():
  data = read_userdata_json(TEMPLATES_PATH)
  if not data or not isinstance(data, dict):
    return {"templates": []}
  if "templates" not in data or not isinstance(data["templates"], list):
    data["templates"] = []
  return data


def _save_templates(data):
  save_userdata_json(TEMPLATES_PATH, data)


@routes.get('/rgthree/api/power_lora/templates')
async def api_get_power_lora_templates(request):
  """Returns list of templates, or a single one by name via `?name=`."""
  name = get_param(request, 'name')
  data = _load_templates()
  templates = data.get("templates", [])
  if name:
    for t in templates:
      if t.get("name") == name:
        return web.json_response(t)
    return web.json_response({"status": 404, "error": f"Template not found: {name}"})
  # Return minimal info for listing
  listing = [{"name": t.get("name"), "modified": t.get("modified"), "created": t.get("created")} for t in templates]
  return web.json_response(listing)


@routes.post('/rgthree/api/power_lora/templates')
async def api_post_power_lora_templates(request):
  """Saves or updates a template. Expects body.json = { name, items }"""
  post = await request.post()
  try:
    payload = post.get('json')
    import json as _json
    payload = _json.loads(payload) if isinstance(payload, str) else payload
  except Exception:
    return web.json_response({"status": 400, "error": "Invalid JSON payload"})

  name = (payload or {}).get('name')
  items = (payload or {}).get('items')
  if not name or not isinstance(items, list):
    return web.json_response({"status": 400, "error": "Missing name or items[]"})

  data = _load_templates()
  templates = data.get("templates", [])
  now = int(time.time())
  existing = next((t for t in templates if t.get('name') == name), None)
  if existing:
    existing['items'] = items
    existing['modified'] = now
  else:
    templates.append({"name": name, "items": items, "created": now, "modified": now})
  data['templates'] = templates
  _save_templates(data)
  return web.json_response({"status": 200})
