# Add 'saved_prompts' as a folder for Power Prompt node.
import folder_paths
folder_paths.folder_names_and_paths['saved_prompts'] = ([], set(['.txt']))



# Alright, I don't like doing this, but until https://github.com/comfyanonymous/ComfyUI/issues/1502
# and/or https://github.com/comfyanonymous/ComfyUI/pull/1503 is pulled into ComfyUI, we need a way
# to optimize the recursion that happens on prompt eval. This is particularly important for
# rgnodes because workflows can contain many context nodes. With `Context Big`` nodes being
# introduced, the number of input recursion that happens in these methods is exponential with a
# saving of 1000's of percentage points over.
import execution

execution.rgthree_cache_recursive_output_delete_if_changed_output = {}
execution.rgthree_cache_recursive_will_execute = {}

def rgthree_execute(self, *args, **kwargs):
    # When we execute, we'll reset our global cache here.
    execution.rgthree_cache_recursive_output_delete_if_changed_output = {}
    execution.rgthree_cache_recursive_will_execute = {}
    return self.old_execute(*args, **kwargs)


def rgthree_recursive_will_execute(prompt, outputs, current_item):
    unique_id = current_item
    inputs = prompt[unique_id]['inputs']
    will_execute = []
    if unique_id in outputs:
        return []

    for x in inputs:
        input_data = inputs[x]
        if isinstance(input_data, list):
            input_unique_id = input_data[0]
            output_index = input_data[1]
            node_output_cache_key = f'{input_unique_id}.{output_index}'
            # If this node's output has already been recursively evaluated, then we can reuse.
            if node_output_cache_key in execution.rgthree_cache_recursive_will_execute:
                will_execute = execution.rgthree_cache_recursive_will_execute[node_output_cache_key]
            elif input_unique_id not in outputs:
                will_execute += execution.recursive_will_execute(prompt, outputs, input_unique_id)
                execution.rgthree_cache_recursive_will_execute[node_output_cache_key] = will_execute

    return will_execute + [unique_id]


def rgthree_recursive_output_delete_if_changed(prompt, old_prompt, outputs, current_item):
    unique_id = current_item
    inputs = prompt[unique_id]['inputs']
    class_type = prompt[unique_id]['class_type']
    class_def = execution.nodes.NODE_CLASS_MAPPINGS[class_type]

    is_changed_old = ''
    is_changed = ''
    to_delete = False
    if hasattr(class_def, 'IS_CHANGED'):
        if unique_id in old_prompt and 'is_changed' in old_prompt[unique_id]:
            is_changed_old = old_prompt[unique_id]['is_changed']
        if 'is_changed' not in prompt[unique_id]:
            input_data_all = execution.get_input_data(inputs, class_def, unique_id, outputs)
            if input_data_all is not None:
                try:
                    #is_changed = class_def.IS_CHANGED(**input_data_all)
                    is_changed = execution.map_node_over_list(class_def, input_data_all, "IS_CHANGED")
                    prompt[unique_id]['is_changed'] = is_changed
                except:
                    to_delete = True
        else:
            is_changed = prompt[unique_id]['is_changed']

    if unique_id not in outputs:
        return True

    if not to_delete:
        if is_changed != is_changed_old:
            to_delete = True
        elif unique_id not in old_prompt:
            to_delete = True
        elif inputs == old_prompt[unique_id]['inputs']:
            for x in inputs:
                input_data = inputs[x]

                if isinstance(input_data, list):
                    input_unique_id = input_data[0]
                    output_index = input_data[1]
                    node_output_cache_key = f'{input_unique_id}.{output_index}'
                    # If this node's output has already been recursively evaluated, then we can stop.
                    if node_output_cache_key in execution.rgthree_cache_recursive_output_delete_if_changed_output:
                        to_delete = execution.rgthree_cache_recursive_output_delete_if_changed_output[node_output_cache_key]
                    elif input_unique_id in outputs:
                        to_delete = execution.recursive_output_delete_if_changed(prompt, old_prompt, outputs, input_unique_id)
                        execution.rgthree_cache_recursive_output_delete_if_changed_output[node_output_cache_key] = to_delete
                    else:
                        to_delete = True
                    if to_delete:
                        break
        else:
            to_delete = True

    if to_delete:
        d = outputs.pop(unique_id)
        del d
    return to_delete




execution.PromptExecutor.old_execute = execution.PromptExecutor.execute
execution.PromptExecutor.execute = rgthree_execute

execution.old_recursive_output_delete_if_changed = execution.recursive_output_delete_if_changed
execution.recursive_output_delete_if_changed = rgthree_recursive_output_delete_if_changed
