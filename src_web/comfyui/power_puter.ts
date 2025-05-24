import type {IWidget, LGraphNodeConstructor} from "@comfyorg/litegraph";
import type {ComfyNodeDef} from "typings/comfy.js";

import {app} from "scripts/app.js";
import {RgthreeBaseServerNode} from "./base_node.js";
import {NodeTypesString} from "./constants.js";
import {removeUnusedInputsFromEnd} from "./utils_inputs_outputs.js";
import {debounce} from "rgthree/common/shared_utils.js";
import {ComfyWidgets} from "scripts/widgets.js";

const ALPHABET = "abcdefghijklmnopqrstuv".split("");

class RgthreePowerPuter extends RgthreeBaseServerNode {
  static override title = NodeTypesString.POWER_PUTER;
  static override type = NodeTypesString.POWER_PUTER;
  static comfyClass = NodeTypesString.POWER_PUTER;

  private outputTypeWidget!: IWidget;
  private expressionWidget!: IWidget;
  private stabilizeBound = this.stabilize.bind(this);

  constructor(title = NODE_CLASS.title) {
    super(title);
    // Note, configure will add as many as was in the stored workflow automatically.
    this.addAnyInput(2);
    this.addInitialWidgets();
  }

  static override setUp(comfyClass: LGraphNodeConstructor, nodeData: ComfyNodeDef) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, NODE_CLASS);
  }

  override onConnectionsChange(...args: any[]): void {
    super.onConnectionsChange?.apply(this, [...arguments] as any);
    this.scheduleStabilize();
  }

  scheduleStabilize(ms = 64) {
    return debounce(this.stabilizeBound, ms);
  }

  stabilize() {
    removeUnusedInputsFromEnd(this, 1);
    this.addAnyInput();
    this.setOutput();
  }

  private addInitialWidgets() {
    if (!this.outputTypeWidget) {
      this.outputTypeWidget = this.addWidget(
        "combo",
        "output",
        "STRING",
        (...args) => {
          this.scheduleStabilize();
        },
        {
          values: ["INT", "FLOAT", "STRING", "BOOL", "*"],
        },
      );
      this.expressionWidget = ComfyWidgets["STRING"](
        this,
        "code",
        ["STRING", {multiline: true}],
        app,
      ).widget;
    }
  }

  private addAnyInput(num = 1) {
    for (let i = 0; i < num; i++) {
      this.addInput(ALPHABET[this.inputs.length]!, "*" as string);
    }
  }

  private setOutput() {
    // Set the output data.
    const output = this.outputs[0]!;
    const outputLabel = output.label === "*" || output.label === output.type ? null : output.label;
    output.type = String(this.outputTypeWidget.value);
    output.label = outputLabel || output.type;
  }

  override getHelp() {
    return `
      <p>
        The ${this.type!.replace("(rgthree)", "")} is a powerful and versatile node that opens the
        door for a wide range of utility by offering mult-line code parsing for output. This node
        can be used for simple string concatenation, or math operations; to an image dimension or a
        node's widgets with advanced list comprehension.
        If you want to output something in your workflow, this is the node to do it.
      </p>

      <ul>
        <li><p>
          Evaluate almost any kind of input and more, and choose your output from INT, FLOAT,
          STRING, or BOOL.
        </p></li>
        <li><p>
          Connect some nodes and do simply math operations like <code>a + b</code> or
          <code>ceil(1 / 2)</code>.
        </p></li>
        <li><p>
          Or do more advanced things, like input an image, and get the width like
          <code>a.shape[2]</code>.
        </p></li>
        <li><p>
          Even more powerful, you can target nodes in the prompt that's sent to the backend. For
          instance; if you have a Power Lora Loader node at id #5, and want to get a comma-delimited
          list of the enabled loras, you could enter
          <code>', '.join([v.lora for v in node(5).inputs.values() if 'lora' in v and v.on])</code>.
        </p></li>
      </ul>`;
  }
}

/** An uniformed name reference to the node class. */
const NODE_CLASS = RgthreePowerPuter;

/** Register the node. */
app.registerExtension({
  name: "rgthree.PowerPuter",
  async beforeRegisterNodeDef(nodeType: LGraphNodeConstructor, nodeData: ComfyNodeDef) {
    if (nodeData.name === NODE_CLASS.type) {
      NODE_CLASS.setUp(nodeType, nodeData);
    }
  },
});
