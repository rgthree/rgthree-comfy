import os
import re
import json

from .utils import set_dict_value

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_FILE_PY_PROJECT = os.path.join(_THIS_DIR, '..', 'pyproject.toml')


def read_pyproject():
  """Reads the pyproject.toml file"""
  data = {}
  last_key = ''
  lines = []
  # I'd like to use tomllib/tomli, but I'd much rather not introduce dependencies since I've yet to
  # need to and not everyone may have 3.11. We've got a controlled config file anyway.
  with open(_FILE_PY_PROJECT, "r", encoding='utf-8') as f:
    lines = f.readlines()
  for line in lines:
    line = line.strip()
    if re.match(r'\[([^\]]+)\]$', line):
      last_key = line[1:-1]
      set_dict_value(data, last_key, data[last_key] if last_key in data else {})
      continue
    value_matches = re.match(r'^([^\s\=]+)\s*=\s*(.*)$', line)
    if value_matches:
      try:
        set_dict_value(data, f'{last_key}.{value_matches[1]}', json.loads(value_matches[2]))
      except json.decoder.JSONDecodeError:
        # We don't handle multiline arrays or curly brackets; that's ok, we know the file.
        pass

  return data


_DATA = read_pyproject()

# We would want these to fail if they don't exist, so assume they do.
VERSION: str = _DATA['project']['version']
NAME: str = _DATA['project']['name']
LOGO_URL: str = _DATA['tool']['comfy']['Icon']

if not LOGO_URL.endswith('.svg'):
  raise ValueError('Bad logo url.')

LOGO_SVG = None


def _local_logo_svg():
  """The logo bundled with this repository, used when the remote one is unavailable."""
  import os
  try:
    path = os.path.join(_THIS_DIR, '..', 'web', 'common', 'media', 'rgthree.svg')
    with open(path, 'r', encoding='utf-8') as f:
      return f.read()
  except Exception:
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"></svg>'


async def get_logo_svg():
  import aiohttp
  global LOGO_SVG
  if LOGO_SVG is not None:
    return LOGO_SVG
  # Fetch the logo so we have any updated markup.
  try:
    async with aiohttp.ClientSession(
      trust_env=True, connector=aiohttp.TCPConnector(verify_ssl=True)
    ) as session:
      headers = {
        "user-agent": f"rgthree-comfy/{VERSION}",
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      async with session.get(LOGO_URL, headers=headers) as resp:
        fetched = await resp.text()
    # The response is not guaranteed to be our SVG: a proxy, a captive portal or a
    # CDN error page answers with HTML (Cloudflare pages contain `{` in their CSS,
    # which later blows up `str.format` in the route). Only accept real SVG markup
    # and otherwise fall back to the bundled logo below.
    if '<svg' not in fetched.lower():
      raise ValueError('remote logo is not SVG')
    LOGO_SVG = fetched
    LOGO_SVG = re.sub(r'(id="bg".*fill=)"[^\"]+"', r'\1"{bg}"', LOGO_SVG)
    LOGO_SVG = re.sub(r'(id="fg".*fill=)"[^\"]+"', r'\1"{fg}"', LOGO_SVG)
  except Exception:
    LOGO_SVG = _local_logo_svg()
  return LOGO_SVG
