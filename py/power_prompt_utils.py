"""Utilities for Power Prompt nodes."""
import re
import os
import folder_paths

from .log import log_node_warn, log_node_info


def get_and_strip_loras(prompt, silent=False, log_node="Power Prompt"):
  """Collects and strips lora tags from a prompt."""
  pattern = '<lora:([^:>]*?)(?::(-?\d*(?:\.\d*)?))?>'
  lora_paths = folder_paths.get_filename_list('loras')
  lora_paths_no_ext = [os.path.splitext(x)[0] for x in lora_paths]
  lora_filenames_no_ext = [os.path.splitext(os.path.basename(x))[0] for x in lora_paths]

  matches = re.findall(pattern, prompt)

  loras = []
  for match in matches:
    tag_path = match[0]
    tag_path_no_ext = os.path.splitext(match[0])[0]
    tag_filename_no_ext = os.path.splitext(os.path.basename(match[0]))[0]

    strength = float(match[1] if len(match) > 1 and len(match[1]) else 1.0)
    if strength == 0 and not silent:
      log_node_info(log_node, f'Skipping "{tag_path}" with strength of zero')
      continue

    if tag_path not in lora_paths:
      if tag_path_no_ext in lora_paths_no_ext:
        # See if we've entered the exact path, but without the extension
        tag_path = lora_paths[lora_paths_no_ext.index(tag_path_no_ext)]

      elif tag_path_no_ext == tag_filename_no_ext and tag_filename_no_ext in lora_filenames_no_ext:
        # See if we've entered only a file, that is in only the files
        tag_path = lora_paths[lora_filenames_no_ext.index(tag_filename_no_ext)]

      else:
        # Let's be flexible; see if the entered lora overlaps at all with any of the loras
        found_tag_filename = None
        for index, lora_path in enumerate(lora_paths_no_ext):
          if tag_path_no_ext in lora_path:
            found_tag_filename = lora_paths[index]
            break
        if found_tag_filename:
          if not silent:
            log_node_info(log_node, f'Found "{found_tag_filename}" for "{tag_path}" in prompt')
          tag_path = found_tag_filename
        else:
          if not silent:
            log_node_warn(log_node, f'Lora "{tag_path}" not found, skipping.')
          continue

    loras.append({'lora': tag_path, 'strength': strength})

  return (re.sub(pattern, '', prompt), loras)
