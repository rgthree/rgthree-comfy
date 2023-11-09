// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraph,
  LLink,
  LiteGraph as TLiteGraph,
  LGraphNode as TLGraphNode,
  ContextMenuItem,
  Vector2,
} from "./typings/litegraph.js";
import type { ComfyApp, ComfyNodeConstructor, ComfyObjectInfo } from "./typings/comfy.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import {
  ConnectionType,
  IoDirection,
  PassThroughFollowing,
  addConnectionLayoutSupport,
  addMenuItem,
  applyMixins,
  followConnectionUntilType,
  getConnectedInputNodesAndFilterPassThroughs,
  getConnectedOutputNodesAndFilterPassThroughs,
  matchLocalSlotsToServer,
  replaceNode,
} from "./utils.js";
import { RgthreeBaseNode, RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";

declare const LGraphNode: typeof TLGraphNode;
declare const LiteGraph: typeof TLiteGraph;

/**
 * Takes a non-context node and determins for its input or output slot, if there is a valid
 * connection for an opposite context output or input slot.
 */
function findMatchingIndexByTypeOrName(otherNode: TLGraphNode, otherSlot: INodeInputSlot|INodeOutputSlot, ctxSlots: INodeInputSlot[]|INodeOutputSlot[]) {
  const otherNodeType = (otherNode.type || '').toUpperCase();
  const otherNodeName = (otherNode.title || '').toUpperCase();
  let otherSlotType = otherSlot.type as string;
  if (Array.isArray(otherSlotType) || otherSlotType.includes(',')) {
    otherSlotType = 'COMBO';
  }
  const otherSlotName = otherSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
  const otherSlotLabel = (otherSlot.label || otherSlotName).toUpperCase().replace('OPT_', '').replace('_NAME', '');
  let ctxSlotIndex = -1;
  if (["CONDITIONING", "INT", "STRING", "FLOAT", "COMBO"].includes(otherSlotType)) {
    ctxSlotIndex = ctxSlots.findIndex((ctxSlot) => {
      const ctxSlotName = ctxSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
      const ctxSlotLabel = (ctxSlot.label || ctxSlotName).toUpperCase().replace('OPT_', '').replace('_NAME', '');
      let ctxSlotType = ctxSlot.type as string;
      if (Array.isArray(ctxSlotType) || ctxSlotType.includes(',')) {
        ctxSlotType = 'COMBO';
      }
      if (ctxSlotType !== otherSlotType) {
        return false;
      }
      // Straightforward matches.
      if(ctxSlotName === otherSlotName
            || (ctxSlotLabel && otherSlotLabel && ctxSlotLabel == otherSlotLabel)
            || (ctxSlotName === "SEED" && otherSlotName.includes("SEED"))
            || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("AT_STEP"))
            || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("REFINER_STEP"))) {
        return true;
      }
      // If postive other node, try to match conditining and text.
      if ((otherNodeType.includes('POSITIVE') || otherNodeName.includes('POSITIVE')) &&
          (
            (ctxSlotName === 'POSITIVE' && otherSlotType === 'CONDITIONING')
            || (ctxSlotName === 'TEXT_POS_G' && otherSlotName.includes("TEXT_G"))
            || (ctxSlotName === 'TEXT_POS_L' && otherSlotName.includes("TEXT_L"))
          )
          ) {
        return true;
      }
      if ((otherNodeType.includes('NEGATIVE') || otherNodeName.includes('NEGATIVE')) &&
          (
            (ctxSlotName === 'NEGATIVE' && otherSlotType === 'CONDITIONING')
            || (ctxSlotName === 'TEXT_NEG_G' && otherSlotName.includes("TEXT_G"))
            || (ctxSlotName === 'TEXT_NEG_L' && otherSlotName.includes("TEXT_L"))
          )
          ) {
        return true;
      }
      return false;
    });
  } else {
    ctxSlotIndex = ctxSlots.map((s) => s.type).indexOf(otherSlotType);
  }
  return ctxSlotIndex;
}


/**
 * A Base Context node for other context based nodes to extend.
 */
class BaseContextNode extends RgthreeBaseServerNode {
  constructor(title: string) {
    super(title);
  }

  override connectByType<T = any>(
    slot: string | number,
    sourceNode: TLGraphNode,
    sourceSlotType: string,
    optsIn: string,
  ): T | null {
    let canConnect =
      super.connectByType &&
      super.connectByType.call(this, slot, sourceNode, sourceSlotType, optsIn);
    if (!super.connectByType) {
      canConnect = LGraphNode.prototype.connectByType.call(
        this,
        slot,
        sourceNode,
        sourceSlotType,
        optsIn,
      );
    }
    if (!canConnect && slot === 0) {
      const ctrlKey = rgthree.ctrlKey;
      // Okay, we've dragged a context and it can't connect.. let's connect all the other nodes.
      // Unfortunately, we don't know which are null now, so we'll just connect any that are
      // not already connected.
      for (const [index, input] of (sourceNode.inputs || []).entries()) {
        if (input.link && !ctrlKey) {
          continue;
        }
        const thisOutputSlot = findMatchingIndexByTypeOrName(sourceNode, input, this.outputs);
        if (thisOutputSlot > -1) {
          this.connect(thisOutputSlot, sourceNode, index);
        }
      }
    }
    return null;
  }

  override connectByTypeOutput<T = any>(slot: string | number, sourceNode: TLGraphNode, sourceSlotType: string, optsIn: string): T | null {
    let canConnect =
      super.connectByTypeOutput &&
      super.connectByTypeOutput.call(this, slot, sourceNode, sourceSlotType, optsIn);
    if (!super.connectByType) {
      canConnect = LGraphNode.prototype.connectByTypeOutput.call(
        this,
        slot,
        sourceNode,
        sourceSlotType,
        optsIn,
      );
    }
    if (!canConnect && slot === 0) {
      const ctrlKey = rgthree.ctrlKey;
      // Okay, we've dragged a context and it can't connect.. let's connect all the other nodes.
      // Unfortunately, we don't know which are null now, so we'll just connect any that are
      // not already connected.
      for (const [index, output] of (sourceNode.outputs || []).entries()) {
        if (output.links?.length && !ctrlKey) {
          continue;
        }
        const thisInputSlot = findMatchingIndexByTypeOrName(sourceNode, output, this.inputs);
        if (thisInputSlot > -1) {
          sourceNode.connect(index, this, thisInputSlot);
        }
      }
    }
    return null;
  }

  static override setUp(comfyClass: any, ctxClass: any) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, ctxClass);
    addConnectionLayoutSupport(ctxClass, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      ctxClass.category = comfyClass.category;
    });
  }
}

/**
 * The original Context node.
 */
class ContextNode extends BaseContextNode {
  static override title = "Context (rgthree)";
  static override type = "Context (rgthree)";
  static comfyClass = "Context (rgthree)";

  constructor(title = ContextNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextNode);
    addMenuItem(ContextNode, app, {
      name: "Convert To Context Big",
      callback: (node) => {
        replaceNode(node, ContextBigNode.type);
      },
    });
  }
}

/**
 * The Context Big node.
 */
class ContextBigNode extends BaseContextNode {
  static override title = "Context Big (rgthree)";
  static override type = "Context Big (rgthree)";
  static comfyClass = "Context Big (rgthree)";

  constructor(title = ContextBigNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextBigNode);
    addMenuItem(ContextBigNode, app, {
      name: "Convert To Context (Original)",
      callback: (node) => {
        replaceNode(node, ContextNode.type);
      },
    });
  }
}

/**
 * The Context Switch (original) node.
 */
class ContextSwitchNode extends BaseContextNode {
  static override title = "Context Switch (rgthree)";
  static override type = "Context Switch (rgthree)";
  static comfyClass = "Context Switch (rgthree)";

  constructor(title = ContextSwitchNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextSwitchNode);
    addMenuItem(ContextSwitchNode, app, {
      name: "Convert To Context Switch Big",
      callback: (node) => {
        replaceNode(node, ContextSwitchBigNode.type);
      },
    });
  }
}

/**
 * The Context Switch Big node.
 */
class ContextSwitchBigNode extends BaseContextNode {
  static override title = "Context Switch Big (rgthree)";
  static override type = "Context Switch Big (rgthree)";
  static comfyClass = "Context Switch Big (rgthree)";

  constructor(title = ContextSwitchBigNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextSwitchBigNode);
    addMenuItem(ContextSwitchBigNode, app, {
      name: "Convert To Context Switch",
      callback: (node) => {
        replaceNode(node, ContextSwitchNode.type);
      },
    });
  }
}


function addWidgetForDynamicContextOutputs(node: TLGraphNode, inputName: string) {
  node.addCustomWidget({
    name: inputName,
    value: '',
    draw(ctx, node, width, posY, height) {
      return;
    },
    computeSize(width) {
      return [0,0];
    },
    serializeValue() {
      const value = (node.outputs || []).map((o, i) => i > 0 && o.name).filter(n => n !== false).join(',');
      return value;
    }
  });
}

/**
 * The Dynamic Context node.
 */
class ContextDynamicNode extends BaseContextNode {
  static override title = "Dynamic Context (rgthree)";
  static override type = "Dynamic Context (rgthree)";
  static comfyClass = "Dynamic Context (rgthree)";

  constructor(title = ContextNode.title) {
    super(title);
  }

  override getWidgets() {
    return Object.assign({},
      super.getWidgets(),
      {
        'DYNAMIC_CONTEXT_OUTPUTS': (node: TLGraphNode, inputName: string, inputData: any, app: ComfyApp) => {
          addWidgetForDynamicContextOutputs(node, inputName);
        }
      }
    );
  }

  override onNodeCreated() {
    if (this.inputs[this.inputs.length - 1]!.type === '*') {
      this.removeOutput(this.inputs.length - 1);
    } else {
      this.addInput('+','*');
    }
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextDynamicNode);
  }

  override clone() {
    const cloned = super.clone();
    while (cloned.inputs.length > 1) {
      cloned.removeInput(cloned.inputs.length - 1);
    }
    cloned.addInput('+', '*');
    return cloned;
  }

  private stripOwnedPrefix(name: string) {
    return name.replace(/^\+\s*/, '');
  }

  private addOwnedPrefix(name: string) {
    return `+ ${this.stripOwnedPrefix(name)}`;
  }

  private isOwnedInput(inputOrName: INodeInputSlot|string|undefined) {
    const name = typeof inputOrName == 'string' ? inputOrName : inputOrName?.name || '';
    return name.startsWith('+ ');
  }

  override onConnectionsChange(
    type: number,
    slotIndex: number,
    isConnected: boolean,
    linkInfo: LLink,
    ioSlot: INodeOutputSlot | INodeInputSlot,
  ) {
    super.onConnectionsChange?.(type, slotIndex, isConnected, linkInfo, ioSlot);
    if (this.configuring) {
      return;
    }
    if (type === LiteGraph.INPUT) {
      if (isConnected) {
        this.handleInputConnected(slotIndex);
      } else {
        this.handleInputDisconnected(slotIndex);
      }
    }
  }

  private stabilizeNames() {
    const names: string[] = []
    const indexesChanged: number[] = [];
    for (const [index, input] of this.inputs.entries()) {
      if (index === 0 || index === this.inputs.length - 1) {
        continue
      }
      // Clear labels, for debug at least.
      input.label = undefined;
      this.outputs[index]!.label = undefined;

      let origName = this.stripOwnedPrefix(input.name).replace(/\.\d+$/, '');
      let name = input.name;
      // We can't modify an upstream name, so just add it.
      if (!this.isOwnedInput(name)) {
        names.push(name.toLocaleUpperCase());
      } else {
        let n = 0;
        name = this.addOwnedPrefix(origName);
        while (names.includes(this.stripOwnedPrefix(name).toLocaleUpperCase())) {
          name = `${this.addOwnedPrefix(origName)}.${++n}`;
        }
        names.push(this.stripOwnedPrefix(name).toLocaleUpperCase());
        if (input.name !== name) {
          input.name = name;
          this.outputs[index]!.name = this.stripOwnedPrefix(name).toLocaleUpperCase();
          indexesChanged.push(index);
        }
      }
    }
    if (indexesChanged.length) {
      this.updateDownstream('update', indexesChanged);
    }
  }

  override getSlotMenuOptions(info: { slot: number; input?: INodeInputSlot | undefined; output?: INodeOutputSlot | undefined; link_pos: Vector2; }): ContextMenuItem[] {

    const opts: ContextMenuItem[] = [];

    if (info.input) {
      if (this.isOwnedInput(info.input.name)) {
        opts.push({ content: 'Rename Label', callback: () => {
          var dialog = app.canvas.createDialog(
              "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
              {}
          );
          var dialogInput = dialog.querySelector("input");
          if (dialogInput) {
            dialogInput.value = info.input!.label || "";
          }
          var inner = () => {
            app.graph.beforeChange();
            let newName = dialogInput.value.trim() || this.getSlotDefaultInputLabel(info.slot);
            const oldName = info.input!.name
            info.input!.name = newName;
            if (this.isOwnedInput(oldName)) {
              info.input!.name = this.addOwnedPrefix(info.input!.name);
            } else if (this.isOwnedInput(info.input!.name)) {
              info.input!.name = this.stripOwnedPrefix(info.input!.name);
            }
            this.outputs[info.slot]!.name = this.stripOwnedPrefix(info.input!.name).toLocaleUpperCase();
            this.updateDownstream('update', [info.slot]);
            this.stabilizeNames();
            this.setDirtyCanvas(true, true);
            dialog.close();
            app.graph.afterChange();
          }
          dialog.querySelector("button").addEventListener("click", inner);
          dialogInput.addEventListener("keydown", (e: KeyboardEvent) => {
            dialog.is_modified = true;
            if (e.keyCode == 27) {
              //ESC
              dialog.close();
            } else if (e.keyCode == 13) {
              inner(); // save
            } else if (e.keyCode != 13 && (e.target as HTMLElement)?.localName != "textarea") {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
          });
          dialogInput.focus();
        } });

        opts.push({ content: 'Delete Input', callback: () => {
          this.removeInput(info.slot);
        }});
      }
    }

    return opts;
  }

  override removeInput(slot: number): void {
    super.removeInput(slot);
    if (this.outputs[slot]) {
      this.removeOutput(slot);
    }
    this.updateDownstream('disconnect', [slot]);
    this.stabilizeNames();
  }

  getSlotDefaultInputLabel(slot: number) {
    const input = this.inputs[slot]!;
    let defaultLabel = this.stripOwnedPrefix(input.name).toLowerCase();
    return defaultLabel.toLocaleLowerCase();
  }

  updateFromUpstream(update: 'connect'|'disconnect'|'update', node: ContextDynamicNode, slotIndexes: number[]) {
    if (update == 'connect') {
      for (const baseIndex of slotIndexes) {
        const baseInput = node.inputs[baseIndex]!;
        const baseInputName = this.stripOwnedPrefix(baseInput.name)
        this.addInput(baseInputName, baseInput.type);
        this.inputs.splice(baseIndex, 0, this.inputs.splice(this.inputs.length - 1, 1)[0]!);
        this.addOutput(baseInputName.toUpperCase(), baseInput.type);
        this.outputs.splice(baseIndex, 0, this.outputs.splice(this.outputs.length - 1, 1)[0]!);
      }
      this.updateDownstream(update, slotIndexes);
      this.stabilizeNames();
    } else if (update == 'disconnect') {
      for (let index = this.inputs.length - 1; index > 0; index--) {
        if (index == 0) {
          continue;
        }
        if (slotIndexes.includes(index)) {
          this.removeInput(index);
        }
      }
    } else if (update == 'update') {
      for (const baseIndex of slotIndexes) {
        const baseInput = node.inputs[baseIndex]!;
        this.inputs[baseIndex]!.name = this.stripOwnedPrefix(baseInput.name);
        this.outputs[baseIndex]!.name = this.inputs[baseIndex]!.name.toUpperCase()
      }
      this.updateDownstream(update, slotIndexes);
      this.stabilizeNames();
    }

    // Since we just spliced in a bunch, we need to clean the links
    for (let index = this.inputs.length - 1; index > 0; index--) {
      const input = this.inputs[index];
      if (input?.link != null) {
        app.graph.links[input.link].target_slot = index;
      }
      const output = this.outputs[index];
      for (const link of output?.links || []) {
        app.graph.links[link].origin_slot = index;
      }
    }
    this.setSize( this.computeSize() );
    this.setDirtyCanvas(true, true);
  }

  updateDownstream(update: 'connect'|'disconnect'|'update', slotIndexes: number[]) {
    const nodes = getConnectedOutputNodesAndFilterPassThroughs(this, this, 0);
    for (const node of nodes) {
      (node as ContextDynamicNode)?.updateFromUpstream?.(update, this, slotIndexes);
    }
  }


  handleInputConnected(slotIndex: number) {
    const ioSlot = this.inputs[slotIndex]!;
    const connectedIndexes = [];
    if (slotIndex === 0) {
      const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, 0);
      if ((baseNodes[0] as ContextDynamicNode)?.updateFromUpstream) {
        this.updateFromUpstream('connect', baseNodes[0] as ContextDynamicNode,
          baseNodes[0]!.inputs!.map((input, index) => index > 0 && input.name !== '+' ? index : null).filter(i => i != null) as number[]);
      }
    } else if (ioSlot.type === '*') {
      // If our type is a "*" and we have a link, then try to find the correct type.
      let cxn : ConnectionType|null = null;
      if (ioSlot.link) {
        cxn = followConnectionUntilType(this, IoDirection.INPUT, slotIndex, true);
      }
      if (cxn?.type) {
        let name = this.addOwnedPrefix(cxn.name!);
        // If we're all uppercase, then make the input lowercase (semi-standard).
        if (name.match(/^\+\s*[A-Z_]+$/)) {
          name = name.toLowerCase()
        }
        this.inputs[slotIndex]!.type = cxn.type as string;
        this.inputs[slotIndex]!.name = name;
        this.inputs[slotIndex]!.removable = true;

        if (!this.outputs[slotIndex]) {
          this.addOutput('*', '*');
        }
        this.outputs[slotIndex]!.type = cxn.type as string;
        this.outputs[slotIndex]!.name = this.stripOwnedPrefix(name).toLocaleUpperCase();
        connectedIndexes.push(slotIndex);

        this.addInput('+', '*');
        this.updateDownstream('connect', connectedIndexes);
        this.stabilizeNames();
      }
    }
  }


  handleInputDisconnected(slotIndex: number) {
    const ioSlot = this.inputs[slotIndex]!;
    if (slotIndex === 0) {
      // Disconnect all non-"+" inputs
      for (let index = this.inputs.length - 1; index > 0; index--) {
        if (index == 0) {
          continue;
        }
        if (!this.isOwnedInput(this.inputs[index]?.name)) {
          this.removeInput(index);
        }
      }
    }
  }

  getInputNames() {
    return this.inputs.map(input => input.name);
  }

}

const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode, ContextDynamicNode];
const contextTypeToServerDef: { [type: string]: ComfyObjectInfo } = {};

function fixBadConfigs(node: ContextNode) {
  // Dumb mistake, but let's fix our mispelling. This will probably need to stay in perpetuity to
  // keep any old workflows operating.
  const wrongName = node.outputs.find((o, i) => o.name === 'CLIP_HEIGTH');
  if (wrongName) {
    wrongName.name = 'CLIP_HEIGHT';
  }
}

app.registerExtension({
  name: "rgthree.Context",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    // Loop over out context nodes and see if any match the server data.
    if (nodeData.name === ContextNode.type) {
    }

    for (const ctxClass of contextNodes) {
      if (nodeData.name === ctxClass.type) {
        ctxClass.nodeData = nodeData;
        ctxClass.nodeType = nodeType;
        contextTypeToServerDef[ctxClass.type] = nodeData;
        ctxClass.setUp(nodeType as any);
        break;
      }
    }
  },

  async nodeCreated(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type];
    if (serverDef) {
      fixBadConfigs(node as ContextNode);
      if (!type!.includes('Dynamic')) {
        matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
        // Switches don't need to change inputs, only context outputs
        if (!type!.includes("Switch")) {
          matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
        }
      }
      // }, 100);
    }
  },

  /**
   * When we're loaded from the server, check if we're using an out of date version and update our
   * inputs / outputs to match.
   */
  async loadedGraphNode(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type];
    if (serverDef) {
      fixBadConfigs(node as ContextNode);
      if (!type!.includes('Dynamic')) {
        matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
        // Switches don't need to change inputs, only context outputs
        if (!type!.includes("Switch")) {
          matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
        }
      }
    }
  },
});
