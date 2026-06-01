from .utils import get_dict_value


def get_worflow_node(extra_pnginfo, node_id: str, default=None):
  # First, break out of any subgraphs
  node_ids = str(node_id).split(':')
  workflow_nodes = get_dict_value(extra_pnginfo, 'workflow.nodes', default=[])
  workflow_subgraphs = get_dict_value(extra_pnginfo, 'workflow.definitions.subgraphs', default=[])
  nodes_list = workflow_nodes
  found = None
  for individual_node_id in node_ids:
    found = next((n for n in nodes_list if str(n['id']) == individual_node_id), None)
    if isinstance(found, dict) and 'type' in found:
      # Are we a subgraph? Right now, subgraph types are a UUID that exists as an id in the
      # aubgraphs list. But, rather than check if we're a UUID, let's just check if it exists
      # anyway, that when if (when) Comfy changes the id structure we'll keep working.
      subgraph = next((n for n in workflow_subgraphs if str(n['id']) == found['type']), None)
      if isinstance(subgraph, dict) and 'nodes' in subgraph:
        nodes_list = subgraph['nodes']
  return found if found is not None else default
