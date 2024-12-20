import { app } from "scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { SERVICE as KEY_EVENT_SERVICE } from "./services/key_events_services.js";
import { NodeTypesString } from "./constants.js";
import type {
  LGraph,
  LGraphCanvas,
  INumberWidget,
  LGraphNode,
  Vector2,
} from "typings/litegraph.js";
import { getClosestOrSelf, queryOne } from "rgthree/common/utils_dom.js";

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

  constructor(title = Bookmark.title) {
    super(title);
    const nextShortcutChar = getNextShortcut();

    // Shortcut key widget
    this.addWidget(
      "text",
      "shortcut_key",
      nextShortcutChar,
      (value: string, ...args) => {
        value = value.trim()[0] || "1";
      },
      {y: 8},
    );

    // Zoom widget
    this.addWidget<INumberWidget>("number", "zoom", 1, (value: number) => {}, {
      y: 8 + LiteGraph.NODE_WIDGET_HEIGHT + 4,
      max: 2,
      min: 0.5,
      precision: 2,
    });

    // Preset dropdown widget
    const presets = [
      "top left",
      "top center",
      "top right",
      "center",
      "bottom left",
      "bottom center",
      "bottom right",
    ];
    this.addWidget(
      "combo",
      "Preset",
      "center", // Default value
      (value: string) => {
      },
      {
        y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 2,
        values: presets,
      },
    );

    // X-Offset widget
    this.addWidget<INumberWidget>("number", "X-Offset", 16, (value: number) => {}, {
      y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 3,
      precision: 0,
    });

    // Y-Offset widget
    this.addWidget<INumberWidget>("number", "Y-Offset", 40, (value: number) => {}, {
      y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 4,
      precision: 0,
    });

    this.keypressBound = this.onKeypress.bind(this);
    this.title = "🔖";
    this.onConstructed();
  }

  // override computeSize(out?: Vector2 | undefined): Vector2 {
  //   super.computeSize(out);
  //   const minHeight = (this.widgets?.length || 0) * (LiteGraph.NODE_WIDGET_HEIGHT + 4) + 16;
  //   this.size[1] = Math.max(minHeight, this.size[1]);
  // }

  get shortcutKey(): string {
    return this.widgets[0]?.value?.toLocaleLowerCase() ?? "";
  }

  override onAdded(graph: LGraph): void {
    KEY_EVENT_SERVICE.addEventListener("keydown", this.keypressBound as EventListener);
  }

  override onRemoved(): void {
    KEY_EVENT_SERVICE.removeEventListener("keydown", this.keypressBound as EventListener);
  }

  onKeypress(event: CustomEvent<{originalEvent: KeyboardEvent}>) {
    const originalEvent = event.detail.originalEvent;
    const target = (originalEvent.target as HTMLElement)!;
    if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
      return;
    }

    // Only the shortcut keys are held down, optionally including "shift".
    if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0]!.value, true)) {
      this.canvasToBookmark();
      originalEvent.preventDefault();
      originalEvent.stopPropagation();
    }
  }

  /**
   * Called from LiteGraph's `processMouseDown` after it would invoke the input box for the
   * shortcut_key, so we check if it exists and then add our own event listener so we can track the
   * keys down for the user.
   */
  override onMouseDown(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    const input = queryOne<HTMLInputElement>(".graphdialog > input.value");
    if (input && input.value === this.widgets[0]?.value) {
      input.addEventListener("keydown", (e) => {
        // ComfyUI swallows keydown on inputs, so we need to call out to rgthree to use downkeys.
        KEY_EVENT_SERVICE.handleKeyDownOrUp(e);
        e.preventDefault();
        e.stopPropagation();
        input.value = Object.keys(KEY_EVENT_SERVICE.downKeys).join(" + ");
      });
    }
  }

  canvasToBookmark() {
    const canvas = app.canvas as LGraphCanvas;

    if (!canvas?.ds?.offset || canvas.ds.scale == null) {
      console.error("Canvas offset or scale is undefined.");
      return;
    }

    // Preset mapping
    const presets: Record<string, {x: number; y: number}> = {
      "top left": {x: 0, y: 0},
      "top center": {x: canvas.canvas.width / 2, y: 0},
      "top right": {x: canvas.canvas.width, y: 0},
      "center": {x: canvas.canvas.width / 2, y: canvas.canvas.height / 2},
      "bottom left": {x: 0, y: canvas.canvas.height},
      "bottom center": {x: canvas.canvas.width / 2, y: canvas.canvas.height},
      "bottom right": {x: canvas.canvas.width, y: canvas.canvas.height},
    };

    // Get the preset value from a widget or input
    const presetName = String(this.widgets[2]?.value || "center"); // Default to "center"

    // Find the corresponding preset
    const preset = presets[presetName];
    if (!preset) {
      console.error(`Invalid preset: ${presetName}`);
      return;
    }

    // Get the X and Y offset values from the widgets
    const xOffset = Number(this.widgets[3]?.value || 0); // X-Offset widget
    const yOffset = Number(this.widgets[4]?.value || 0); // Y-Offset widget

    // Apply the offsets to the preset positions
    canvas.ds.offset[0] = -this.pos[0] + preset.x + xOffset;
    canvas.ds.offset[1] = -this.pos[1] + preset.y + yOffset;

    // Apply scale
    canvas.ds.scale = Number(this.widgets[1]?.value || 1);

    // Mark the canvas as dirty
    canvas.setDirty(true, true);
  }
}

app.registerExtension({
  name: "rgthree.Bookmark",
  registerCustomNodes() {
    Bookmark.setUp();
  },
});

function isBookmark(node: LGraphNode): node is Bookmark {
  return node.type === NodeTypesString.BOOKMARK;
}

function getExistingShortcuts() {
  const graph: LGraph = app.graph;
  const bookmarkNodes = graph._nodes.filter(isBookmark);
  const usedShortcuts = new Set(bookmarkNodes.map((n) => n.shortcutKey));
  return usedShortcuts;
}

const SHORTCUT_DEFAULTS = "1234567890abcdefghijklmnopqrstuvwxyz".split("");
function getNextShortcut() {
  const existingShortcuts = getExistingShortcuts();
  return SHORTCUT_DEFAULTS.find((char) => !existingShortcuts.has(char)) ?? "1";
}
