import json
import os
from aiohttp import web
from server import PromptServer
from .utils_server import get_param
from ..utils import load_json_file

routes = PromptServer.instance.routes

# Templates are stored in user's ComfyUI directory under rgthree/templates/
def get_templates_dir():
    import folder_paths
    user_dir = folder_paths.get_user_directory()
    templates_dir = os.path.join(user_dir, "rgthree", "templates")
    os.makedirs(templates_dir, exist_ok=True)
    return templates_dir

def get_power_lora_templates_file():
    return os.path.join(get_templates_dir(), "power_lora_templates.json")

def load_power_lora_templates():
    """ Load all power lora templates from file """
    templates_file = get_power_lora_templates_file()
    if os.path.exists(templates_file):
        return load_json_file(templates_file) or {}
    return {}

def save_power_lora_templates(templates_data):
    """ Save power lora templates to file """
    templates_file = get_power_lora_templates_file()
    with open(templates_file, 'w') as f:
        json.dump(templates_data, f, indent=2)

@routes.get('/rgthree/api/power-lora-templates')
def api_get_power_lora_templates(request):
    """ Returns all power lora templates or a specific template by name """
    template_name = get_param(request, 'name')
    templates = load_power_lora_templates()
    
    if template_name:
        # Return specific template
        if template_name in templates:
            return web.json_response({
                "status": "ok", 
                "data": {
                    "name": template_name,
                    "items": templates[template_name]
                }
            })
        else:
            return web.json_response({"status": "error", "message": "Template not found"}, status=404)
    else:
        # Return list of all templates
        template_list = [{"name": name, "items": items} for name, items in templates.items()]
        return web.json_response({"status": "ok", "data": template_list})

@routes.post('/rgthree/api/power-lora-templates')
async def api_save_power_lora_template(request):
    """ Save a new power lora template """
    try:
        post = await request.post()
        data = json.loads(post.get("json"))
        
        template_name = data.get("name")
        template_items = data.get("items", [])
        
        if not template_name:
            return web.json_response({"status": "error", "message": "Template name is required"}, status=400)
        
        # Load existing templates
        templates = load_power_lora_templates()
        
        # Add/update the template
        templates[template_name] = template_items
        
        # Save back to file
        save_power_lora_templates(templates)
        
        return web.json_response({
            "status": "ok", 
            "message": f"Template '{template_name}' saved successfully"
        })
        
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@routes.delete('/rgthree/api/power-lora-templates')
async def api_delete_power_lora_template(request):
    """ Delete a power lora template """
    try:
        template_name = get_param(request, 'name')
        
        if not template_name:
            return web.json_response({"status": "error", "message": "Template name is required"}, status=400)
        
        # Load existing templates
        templates = load_power_lora_templates()
        
        if template_name not in templates:
            return web.json_response({"status": "error", "message": "Template not found"}, status=404)
        
        # Remove the template
        del templates[template_name]
        
        # Save back to file
        save_power_lora_templates(templates)
        
        return web.json_response({
            "status": "ok", 
            "message": f"Template '{template_name}' deleted successfully"
        })
        
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)