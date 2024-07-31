import type { RgthreeBaseVirtualNodeConstructor } from "typings/rgthree.js";
import type {
  LGraphNode as TLGraphNode,
  IWidget,
  SerializedLGraphNode,
} from "typings/litegraph.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { PassThroughFollowing } from "./utils.js";
import { wait } from "rgthree/common/shared_utils.js";

export class BaseNodeModeChanger extends BaseAnyInputConnectedNode {
  override readonly inputsPassThroughFollowing: PassThroughFollowing = PassThroughFollowing.ALL;

  static collapsible = false;
  override isVirtualNode = true;

  // These Must be overriden
  readonly modeOn: number = -1;
  readonly modeOff: number = -1;

  static "@toggleRestriction" = {
    type: "combo",
    values: ["default", "max one", "always one"],
  };

  constructor(title?: string) {
    super(title);
    this.properties["toggleRestriction"] = "default";
  }

  override onConstructed(): boolean {
    wait(10).then(() => {
      if (this.modeOn < 0 || this.modeOff < 0) {
        throw new Error("modeOn and modeOff must be overridden.");
      }
    });
    this.addOutput("OPT_CONNECTION", "*");
    return super.onConstructed();
  }

  override configure(info: SerializedLGraphNode<TLGraphNode>): void {
    // Patch a small issue (~14h) where multiple OPT_CONNECTIONS may have been created.
    // https://github.com/rgthree/rgthree-comfy/issues/206
    // TODO: This can probably be removed within a few weeks.
    if (info.outputs?.length) {
      info.outputs.length = 1;
    }
    super.configure(info);
  }

  override handleLinkedNodesStabilization(linkedNodes: TLGraphNode[]) {
    for (const [index, node] of linkedNodes.entries()) {
      let widget = this.widgets && this.widgets[index];
      if (!widget) {
        // When we add a widget, litegraph is going to mess up the size, so we
        // store it so we can retrieve it in computeSize. Hacky..
        (this as any)._tempWidth = this.size[0];
        widget = this.addWidget("toggle", "", false, "", { on: "yes", off: "no" });
      }
      node && this.setWidget(widget, node);
    }
    if (this.widgets && this.widgets.length > linkedNodes.length) {
      this.widgets.length = linkedNodes.length;
    }
  }

  protected setWidget(widget: IWidget, linkedNode: TLGraphNode, forceValue?: boolean) {
    const value = forceValue == null ? linkedNode.mode === this.modeOn : forceValue;
    widget.name = `Enable ${linkedNode.title}`;
    widget.options = { on: "yes", off: "no" };
    widget.value = value;
    (widget as any).doModeChange = (forceValue?: boolean, skipOtherNodeCheck?: boolean) => {
      let newValue = forceValue == null ? linkedNode.mode === this.modeOff : forceValue;
      if (skipOtherNodeCheck !== true) {
        if (newValue && this.properties?.["toggleRestriction"]?.includes(" one")) {
          for (const widget of this.widgets) {
            (widget as any).doModeChange(false, true);
          }
        } else if (!newValue && this.properties?.["toggleRestriction"] === "always one") {
          newValue = this.widgets.every((w) => !w.value || w === widget);
        }
      }
      linkedNode.mode = (newValue ? this.modeOn : this.modeOff) as 1 | 2 | 3 | 4;
      widget.value = newValue;
    };
    widget.callback = () => {
      (widget as any).doModeChange();
    };
    if (forceValue != null) {
      linkedNode.mode = (forceValue ? this.modeOn : this.modeOff) as 1 | 2 | 3 | 4;
    }
  }

  forceWidgetOff(widget: IWidget, skipOtherNodeCheck?: boolean) {
    (widget as any).doModeChange(false, skipOtherNodeCheck);
  }
  forceWidgetOn(widget: IWidget, skipOtherNodeCheck?: boolean) {
    (widget as any).doModeChange(true, skipOtherNodeCheck);
  }
  forceWidgetToggle(widget: IWidget, skipOtherNodeCheck?: boolean) {
    (widget as any).doModeChange(!widget.value, skipOtherNodeCheck);
  }
}
