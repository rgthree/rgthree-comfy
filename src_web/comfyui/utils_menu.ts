import { app } from "scripts/app.js";
import { rgthreeApi } from "rgthree/common/rgthree_api.js";

import type {
  LGraphCanvas as TLGraphCanvas,
  IWidget,
  LGraphNode,
  ContextMenuEventListener,
  ContextMenu,
  IContextMenuItem,
} from "../typings/litegraph.js";

const PASS_THROUGH = function <T extends any, I extends any>(item: T) {
  return item as T;
};

/**
 * Shows a lora chooser context menu.
 */
export async function showLoraChooser(
  event: PointerEvent,
  callback: ContextMenuEventListener,
  parentMenu?: ContextMenu | null,
  loras?: string[],
) {
  const canvas = app.canvas as TLGraphCanvas;
  if (!loras) {
    loras = ["None", ...(await rgthreeApi.getLoras())];
  }
  new LiteGraph.ContextMenu(loras, {
    event: event,
    parentMenu,
    title: "Choose a lora",
    scale: Math.max(1, canvas.ds?.scale ?? 1),
    className: "dark",
    callback,
  });
}

/**
 * Shows a context menu chooser of nodes.
 *
 * @param mapFn The function used to map each node to the context menu item. If null is returned
 *     it will be filtered out (rather than use a separate filter method).
 */
export function showNodesChooser<T extends IContextMenuItem>(
  event: PointerEvent,
  mapFn: (n: LGraphNode) => T | null,
  callback: ContextMenuEventListener,
  parentMenu?: ContextMenu,
) {
  const canvas = app.canvas as TLGraphCanvas;
  const nodesOptions: T[] = (app.graph._nodes as LGraphNode[])
    .map(mapFn)
    .filter((e): e is NonNullable<any> => e != null);

  nodesOptions.sort((a: any, b: any) => {
    return a.value - b.value;
  });

  new LiteGraph.ContextMenu(nodesOptions, {
    event: event,
    parentMenu,
    title: "Choose a node id",
    scale: Math.max(1, canvas.ds?.scale ?? 1),
    className: "dark",
    callback,
  });
}

/**
 * Shows a conmtext menu chooser for a specific node.
 *
 * @param mapFn The function used to map each node to the context menu item. If null is returned
 *     it will be filtered out (rather than use a separate filter method).
 */
export function showWidgetsChooser<T extends IContextMenuItem>(
  event: PointerEvent | MouseEvent,
  node: LGraphNode,
  mapFn: (n: IWidget) => T | null,
  callback: ContextMenuEventListener,
  parentMenu?: ContextMenu,
) {
  const options: T[] = (node.widgets || [])
    .map(mapFn)
    .filter((e): e is NonNullable<any> => e != null);
  if (options.length) {
    const canvas = app.canvas as TLGraphCanvas;
    new LiteGraph.ContextMenu(options, {
      event,
      parentMenu,
      title: "Choose an input/widget",
      scale: Math.max(1, canvas.ds?.scale ?? 1),
      className: "dark",
      callback,
    });
  }
}
