from server import PromptServer
from aiohttp import web
import comfy.samplers
import folder_paths

import os
import time
import json

THIS_DIR=os.path.dirname(os.path.abspath(__file__))
DIR_WEB = os.path.abspath(f'{THIS_DIR}/../web/')

routes = PromptServer.instance.routes

@routes.get('/rgthree/link_fixer')
async def comfier_home(request):
  html = ''
  with open(os.path.join(DIR_WEB, 'link_fixer', 'index.html'), 'r', encoding='UTF-8') as file:
    html = file.read()

  return web.Response(text=html, content_type='text/html')


@routes.get('/rgthree/link_fixer/{file}')
async def get_comfier_js(request):
  return web.FileResponse(os.path.join(DIR_WEB, 'link_fixer', request.match_info['file']))