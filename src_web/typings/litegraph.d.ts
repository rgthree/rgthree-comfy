/**
 * This used to clean up the old LiteGraph types but now that we're importing the actual types
 * from https://github.com/Comfy-Org/litegraph.js we just use this to declare the globally available
 * code when inside ComfyUI; as well as any augmentations we do want/need that aren't in the actual
 * LiteGraph types, for whatever reason.
 *
 * Notes:
 *  - Augmentations marked @rgthree are added specifically for rgthree-comfy.
 *  - Augmentations marked @ComfyUI_frontend are from ComfyUI_frontend and yet to be imported.
 *    https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/types/litegraph-augmentation.d.ts
 */
import type {
  LGraphGroup as TLGraphGroup,
  LGraphNode as TLGraphNode,
  LGraph as TLGraph,
  LGraphCanvas as TLGraphCanvas,
  LiteGraph as TLiteGraph,
} from "@litegraph/litegraph.js";

declare global {
  const LiteGraph: typeof TLiteGraph;
  const LGraph: typeof TLGraph;
  const LGraphNode: typeof TLGraphNode;
  const LGraphCanvas: typeof TLGraphCanvas;
  const LGraphGroup: typeof TLGraphGroup;
  interface Window {
    // Used in the common/comfyui_shim to determine if we're in the app or not.
    comfyAPI: {
      // So much more stuffed in here, add as needed.
      [key: string]: any;
    };
  }
}

declare module "@litegraph/litegraph.js" {
  interface INodeSlot {
    // @rgthree
    hidden?: boolean;

    // @rgthree - Used to "disable" an input/output. Used in PowerPrompt to disallow connecting
    // an output if there's no optional corresponding input (since, that would just break).
    disabled?: boolean;

    // @rgthree - A status we put on some nodes so we can draw things around it.
    rgthree_status?: "WARN" | "ERROR";
  }

  interface LGraphNode {
    // @ComfyUI_frontend
    onExecuted?(output: any): void;
  }

  interface LGraphCanvas {
    // @rgthree - Adding this for ComfyUI, since they add this in their own overload in app.js
    selected_group_moving?: boolean;

    // @rgthree - Allows LGraphGroup to be centered (it could just be `{size: Point, pos: Point}`).
    centerOnNode(node: LGraphNode | LGraphGroup);
  }
}

declare module "@litegraph/types/widgets" {
  interface IBaseWidget {
    // @ComfyUI_frontend - Kinda, made this a method instead of a member.
    serializeValue?(node: LGraphNode, index: number): Promise<unknown> | unknown;

    // @ComfyUI_frontend
    inputEl?: HTMLInputElement;

    // @rgthree - A status we put on some nodes so we can draw things around it.
    rgthree_lastValue?: any;
  }
}

declare module "@litegraph/interfaces" {
  // @ComfyUI_frontend
  interface IFoundSlot {
    widget?: IBaseWidget;
  }
}

declare module "@litegraph/LiteGraphGlobal" {
  interface LiteGraphGlobal {
    // @rgthree - Fix: Window is actually optional in the code.
    closeAllContextMenus(ref_window?: Window): void;
  }
}
