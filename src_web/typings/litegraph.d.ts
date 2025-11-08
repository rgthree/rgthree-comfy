/**
 * This used to augment the LiteGraph types, either to fix them for how they actually behave
 * (e.g. marking args that are typed as required as optional because they actually are, etc.) or
 * adding properties/methods that rgthree-comfy adds/uses. Mostly the latter are prefixed 'rgthree_'
 * but not always.
 */
import "@comfyorg/frontend";

declare module "@comfyorg/frontend" {
  interface INodeSlot {
    // @rgthree: Hides a slot for rgthree-comfy draw methods.
    hidden?: boolean;

    // @rgthree: Used to "disable" an input/output. Used in PowerPrompt to disallow connecting
    // an output if there's no optional corresponding input (since, that would just break).
    disabled?: boolean;

    // @rgthree: A status we put on some nodes so we can draw things around it.
    rgthree_status?: "WARN" | "ERROR";
  }

  interface LGraph {
    // @rgthree (Fix): `result` arg is optional in impl.
    findNodesByType(type: string, result?: LGraphNode[]): LGraphNode[];
  }

  interface LGraphNode {
    // @rgthree: rgthree-comfy added this before comfyui did and it was a bit more flexible.
    removeWidget(widget: IBaseWidget | IWidget | number | undefined): void;

    // @rgthree (Fix): Implementation allows a falsy value to be returned and it will suppress the
    // menu all together.
    // NOTE: [🤮] We can't actually augment this because it's a return.. but keeping here because
    // this is how it's actually implemented.
    // getSlotMenuOptions?(this: LGraphNode, slot: IFoundSlot): IContextMenuValue[] | void;

    // @rgthree (Fix): Implementation allows a falsy value to be returned and it will not add items.
    // NOTE: [🤮] We can't actually augment this because it's a return.. but keeping here because
    // this is how it's actually implemented.
    // getExtraMenuOptions?(
    //   canvas: LGraphCanvas,
    //   options: (IContextMenuValue<unknown> | null)[],
    // ): (IContextMenuValue<unknown> | null)[] | void;

    /**
     * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
     *
     * Callback invoked when the node is dragged over from an external source, i.e.
     * a file or another HTML element.
     * @param e The drag event
     * @returns {boolean} True if the drag event should be handled by this node, false otherwise
     */
    onDragOver?(e: DragEvent): boolean;

    /**
     * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
     *
     * Callback invoked when the node is dropped from an external source, i.e.
     * a file or another HTML element.
     * @param e The drag event
     * @returns {boolean} True if the drag event should be handled by this node, false otherwise
     */
    onDragDrop?(e: DragEvent): Promise<boolean> | boolean;

    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    onExecuted?(output: any): void;

    /**
     * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
     *
     * Index of the currently selected image on a multi-image node such as Preview Image
     */
    imageIndex?: number | null;

    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    overIndex?: number | null;

    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    imgs?: HTMLImageElement[];

    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    refreshComboInNode?(defs: Record<string, ComfyNodeDef>);

    /**
     * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
     *
     * widgets_values is set to LGraphNode by `LGraphNode.configure`, but it is not
     * used by litegraph internally. We should remove the dependency on it later.
     */
    widgets_values?: unknown[];
  }

  /**
   * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
   *
   * Only used by the Primitive node. Primitive node is using the widget property
   * to store/access the widget config.
   * We should remove this hacky solution once we have a proper solution.
   *
   * @rgthree - Changed this to add `widget?: IWidgetLocator` to INodeOutputSlot (which matches
   *     INodeInputSlot) and then `[key: symbol]: unknown` to IWidgetLocator as that's how it's
   *     used for CONFIG and GET_CONFIG symbols.
   */
  interface INodeOutputSlot {
    widget?: IWidgetLocator; //{name: string; [key: symbol]: unknown};
  }
  // @rgthree - See above.
  interface IWidgetLocator {
    [key: symbol]: unknown;
  }

  interface LGraphGroup {
    // @rgthree: Track whether a group has any active node from the fast group mode changers.
    rgthree_hasAnyActiveNode?: boolean;
  }

  interface LGraphCanvas {
    // @rgthree (Fix): At one point this was in ComfyUI's app.js. I don't see it now... perhaps it's
    // been removed? We were using it in rgthree-comfy.
    selected_group_moving?: boolean;

    // @rgthree (Fix): Allows LGraphGroup to be passed (it could be `{size: Point, pos: Point}`).
    centerOnNode(node: LGraphNode | LGraphGroup);

    // @rgthree (Fix): Makes item's fields optiona, and other params nullable, as well as adds
    // LGraphGroup to the node, since the implementation accomodates all of these as typed below.
    // NOTE: [🤮] We can't actually augment this because it's static.. but keeping here because
    // this is how it's actually implemented.
    // static onShowPropertyEditor(
    //   item: {
    //     property?: keyof LGraphNode | undefined;
    //     type?: string;
    //   },
    //   options: IContextMenuOptions<string> | null,
    //   e: MouseEvent | null,
    //   menu: ContextMenu<string> | null,
    //   node: LGraphNode | LGraphGroup,
    // ): void;
  }

  interface LGraphNodeConstructor {
    // @rgthree (Fix): Fixes ComfyUI-Frontend which marks this as required, even though elsewhere it
    // defines it as optional (like for the actual for LGraphNode). Our virtual nodes do not have
    // a comfyClass since there's nothing to tie it back to.
    comfyClass?: string;

    // @rgthree: reference the original nodeType data as sometimes extensions clobber it.
    nodeType?: LGraphNodeConstructor | null;
  }
}

declare module "@/lib/litegraph/src/types/widgets" {
  interface IBaseWidget {
    // @rgthree (Fix): Where is this in Comfy types?
    inputEl?: HTMLInputElement;

    // @rgthree: A status we put on some nodes so we can draw things around it.
    rgthree_lastValue?: any;

    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    onRemove?(): void;
    /** Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts */
    serializeValue?(node: LGraphNode, index: number): Promise<unknown> | unknown;
  }

  interface IWidgetOptions {
    /**
     * Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/ba355b543d0b753365c4e2b40ec376e186727c8c/src/types/litegraph-augmentation.d.ts
     *
     * Controls whether the widget's value is included in the API workflow/prompt.
     * - If false, the value will be excluded from the API workflow but still serialized as part of the graph state
     * - If true or undefined, the value will be included in both the API workflow and graph state     *
     * @default true
     * @use {@link IBaseWidget.serialize} if you don't want the widget value to be included in both
     * the API workflow and graph state.
     */
    serialize?: boolean;
  }
}

declare module "@/lib/litegraph/src/interfaces" {
  // @rgthree (Fix): widget is (or was?) available when inputs were moved from a widget.
  interface IFoundSlot {
    widget?: IBaseWidget;
  }
}

declare module "@comfyorg/litegraph/dist/LiteGraphGlobal" {
  interface LiteGraphGlobal {
    // @rgthree (Fix): Window is actually optional in the code.
    closeAllContextMenus(ref_window?: Window): void;
  }
}
