"""Utilities for Power Prompt nodes."""
import re
import os
import folder_paths

from .log import log_node_warn, log_node_info


def get_and_strip_loras(prompt, silent=False, log_node="Power Prompt"):
  """Collects and strips lora tags from a prompt."""
  pattern = '<lora:([^:>]*?)(?::(-?\d*(?:\.\d*)?))?>'
  lora_paths = folder_paths.get_filename_list('loras')
  lora_filenames_no_ext = [os.path.splitext(os.path.basename(x))[0] for x in lora_paths]

  matches = re.findall(pattern, prompt)

  loras = []
  for match in matches:
    tag_filename = match[0]
    strength = float(match[1] if len(match) > 1 and len(match[1]) else 1.0)
    if strength == 0 and not silent:
      log_node_info(log_node, f'Skipping "{tag_filename}" with strength of zero')
      continue

    # Let's be flexible. If the lora filename in the tag doesn't have the extension or
    # path prefix, let's still find and load it.
    if tag_filename not in lora_paths:
      found_tag_filename = None
      for index, value in enumerate(lora_filenames_no_ext):
        if value in tag_filename:
          found_tag_filename = lora_paths[index]
          break
      if found_tag_filename:
        if not silent:
          log_node_info(log_node, f'Found "{found_tag_filename}" for "{tag_filename}" in prompt')
        tag_filename = found_tag_filename
      else:
        if not silent:
          log_node_warn(log_node, f'Lora "{tag_filename}" not found, skipping.')
        continue

    loras.append({'lora': tag_filename, 'strength': strength})

  return (re.sub(pattern, '', prompt), loras)
