import type {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Point,
  CanvasMouseEvent,
  Subgraph,
} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {RgthreeBaseVirtualNode} from "./base_node.js";
import {SERVICE as KEY_EVENT_SERVICE} from "./services/key_events_services.js";
import {SERVICE as BOOKMARKS_SERVICE} from "./services/bookmarks_services.js";
import {NodeTypesString} from "./constants.js";
import {getClosestOrSelf, query} from "rgthree/common/utils_dom.js";
import {wait} from "rgthree/common/shared_utils.js";

/**
 * A bookmark node. Can be placed anywhere in the workflow, and given a shortcut key that will
 * navigate to that node, with it in the top-left corner.
 */
export class Bookmark extends RgthreeBaseVirtualNode {
  static override type = NodeTypesString.BOOKMARK;
  static override title = NodeTypesString.BOOKMARK;
  override comfyClass = NodeTypesString.BOOKMARK;

  // Really silly, but Litegraph assumes we have at least one input/output... so we need to
  // counteract it's computeSize calculation by offsetting the start.
  static slot_start_y = -20;

  // LiteGraph adds more spacing than we want when calculating a nodes' `_collapsed_width`, so we'll
  // override it with a setter and re-set it measured exactly as we want.
  ___collapsed_width: number = 0;

  override isVirtualNode = true;
  override serialize_widgets = true;

  //@ts-ignore - TS Doesn't like us overriding a property with accessors but, too bad.
  override get _collapsed_width() {
    return this.___collapsed_width;
  }

  override set _collapsed_width(width: number) {
    const canvas = app.canvas as LGraphCanvas;
    const ctx = canvas.canvas.getContext("2d")!;
    const oldFont = ctx.font;
    ctx.font = canvas.title_text_font;
    this.___collapsed_width = 40 + ctx.measureText(this.title).width;
    ctx.font = oldFont;
  }

  readonly keypressBound;
  readonly keyupBound;

  private longPressTimer: any = null;
  private longPressTriggered: boolean = false;
  private pendingShortcut: boolean = false;

  constructor(title = Bookmark.title) {
    super(title);
    const nextShortcutChar = BOOKMARKS_SERVICE.getNextShortcut();
    this.addWidget(
      "text",
      "shortcut_key",
      nextShortcutChar,
      (value: string, ...args) => {
        value = value.trim()[0] || "1";
      },
      {
        y: 8,
      },
    );
    this.addWidget("number", "zoom", 1, (value: number) => {}, {
      y: 8 + LiteGraph.NODE_WIDGET_HEIGHT + 4,
      max: 2,
      min: 0.5,
      precision: 2,
    });
    this.keypressBound = this.onKeypress.bind(this);
    this.keyupBound = this.onKeyup.bind(this);
    this.title = "🔖";
    this.onConstructed();
  }

  // override computeSize(out?: Vector2 | undefined): Vector2 {
  //   super.computeSize(out);
  //   const minHeight = (this.widgets?.length || 0) * (LiteGraph.NODE_WIDGET_HEIGHT + 4) + 16;
  //   this.size[1] = Math.max(minHeight, this.size[1]);
  // }

  get shortcutKey(): string {
    return (this.widgets[0]?.value as string)?.toLocaleLowerCase() ?? "";
  }

  override onAdded(graph: LGraph): void {
    KEY_EVENT_SERVICE.addEventListener("keydown", this.keypressBound as EventListener);
    KEY_EVENT_SERVICE.addEventListener("keyup", this.keyupBound as EventListener);
  }

  override onRemoved(): void {
    KEY_EVENT_SERVICE.removeEventListener("keydown", this.keypressBound as EventListener);
    KEY_EVENT_SERVICE.removeEventListener("keyup", this.keyupBound as EventListener);
    this.clearLongPressTimer();
  }

  private clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onKeypress(event: CustomEvent<{originalEvent: KeyboardEvent}>) {
    const originalEvent = event.detail.originalEvent;
    const target = (originalEvent.target as HTMLElement)!;
    if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
      return;
    }

    // Only the shortcut keys are held down, optionally including "shift".
    if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0]!.value as string, true)) {
      // Start tracking a potential long-press. Only set bookmark when on the current visible graph.
      this.pendingShortcut = true;
      this.longPressTriggered = false;

      // Always prevent default once we recognize the shortcut sequence.
      originalEvent.preventDefault();
      originalEvent.stopPropagation();

      if (!this.longPressTimer) {
        this.longPressTimer = setTimeout(() => {
          this.longPressTimer = null;
          // Ensure keys are still held and we're on the current graph before setting.
          if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0]!.value as string, true)
              && this.graph === (app.canvas as LGraphCanvas).getCurrentGraph()) {
            this.setBookmarkFromCanvas();
            this.longPressTriggered = true;
            this.pendingShortcut = false;
          }
        }, 1000);
      }
    }
  }

  onKeyup(event: CustomEvent<{originalEvent: KeyboardEvent}>) {
    const originalEvent = event.detail.originalEvent;
    const target = (originalEvent.target as HTMLElement)!;
    if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
      return;
    }

    // If we were pending and long-press did not trigger, treat as a tap: recall bookmark.
    if (this.pendingShortcut) {
      this.clearLongPressTimer();
      if (!this.longPressTriggered) {
        this.canvasToBookmark();
        originalEvent.preventDefault();
        originalEvent.stopPropagation();
      }
      this.pendingShortcut = false;
      this.longPressTriggered = false;
    }
  }

  /**
   * Called from LiteGraph's `processMouseDown` after it would invoke the input box for the
   * shortcut_key, so we check if it exists and then add our own event listener so we can track the
   * keys down for the user. Note, blocks drag if the return is truthy.
   */
  override onMouseDown(event: CanvasMouseEvent, pos: Point, graphCanvas: LGraphCanvas): boolean {
    const input = query<HTMLInputElement>(".graphdialog > input.value");
    if (input && input.value === this.widgets[0]?.value) {
      input.addEventListener("keydown", (e) => {
        // ComfyUI swallows keydown on inputs, so we need to call out to rgthree to use downkeys.
        KEY_EVENT_SERVICE.handleKeyDownOrUp(e);
        e.preventDefault();
        e.stopPropagation();
        input.value = Object.keys(KEY_EVENT_SERVICE.downKeys).join(" + ");
      });
    }
    return false;
  }

  async canvasToBookmark() {
    const canvas = app.canvas as LGraphCanvas;
    if (this.graph !== app.canvas.getCurrentGraph()) {
      canvas.openSubgraph(this.graph as Subgraph);
      await wait(16);
    }
    // ComfyUI seemed to break us again, but couldn't repro. No reason to not check, I guess.
    // https://github.com/rgthree/rgthree-comfy/issues/71
    if (canvas?.ds?.offset) {
      canvas.ds.offset[0] = -this.pos[0] + 16;
      canvas.ds.offset[1] = -this.pos[1] + 40;
    }
    if (canvas?.ds?.scale != null) {
      canvas.ds.scale = Number(this.widgets[1]!.value || 1);
    }
    canvas.setDirty(true, true);
  }

  /** Sets this bookmark's position and zoom based on the current canvas viewport. */
  setBookmarkFromCanvas() {
    const canvas = app.canvas as LGraphCanvas;
    // Only set when our node is in the current graph.
    if (this.graph !== canvas.getCurrentGraph()) return;
    const offset = canvas?.ds?.offset;
    if (offset) {
      // Inverse of canvasToBookmark padding logic.
      this.pos[0] = -offset[0] + 16;
      this.pos[1] = -offset[1] + 40;
    }
    if (canvas?.ds?.scale != null) {
      // store zoom in widget index 1
      if (this.widgets && this.widgets[1]) {
        this.widgets[1]!.value = Number(canvas.ds.scale || 1);
      }
    }
    canvas.setDirty(true, true);
  }
}

app.registerExtension({
  name: "rgthree.Bookmark",
  registerCustomNodes() {
    Bookmark.setUp();
  },
});
