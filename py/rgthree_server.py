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


# Sometimes other pages (link_fixer, etc.) may want to import JS from the comfyui
# directory. To allows TS to resolve like '../comfyui/file.js', we'll also resolve any module HTTP
# to these routes.
@routes.get('/rgthree/comfyui/{file}')
async def get_comfyui_file_relative(request):
  return web.FileResponse(os.path.join(DIR_WEB, 'comfyui', request.match_info['file']))


@routes.get('/rgthree/link_fixer')
async def link_fixer_home(request):
  html = ''
  with open(os.path.join(DIR_WEB, 'link_fixer', 'index.html'), 'r', encoding='UTF-8') as file:
    html = file.read()

  return web.Response(text=html, content_type='text/html')


@routes.get('/rgthree/link_fixer/{file}')
async def get_link_fixer_file(request):
  return web.FileResponse(os.path.join(DIR_WEB, 'link_fixer', request.match_info['file']))
