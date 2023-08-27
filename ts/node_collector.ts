// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {LLink, LGraph, ContextMenuItem, LGraphCanvas, SerializedLGraphNode, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph, IContextMenuOptions, ContextMenu} from './typings/litegraph.js';
import { addConnectionLayoutSupport, wait } from "./utils.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

class CollectorNode extends LGraphNode {

  static legacyType = "Node Combiner (rgthree)";
  static override title = "Node Collector (rgthree)";
  // `category` seems to get reset at register, so we'll
  // re-reset it after the register call. ¯\_(ツ)_/¯
  static category = 'rgthree';
  static _category = 'rgthree';

  isVirtualNode = true;

  constructor(title = CollectorNode.title) {
    super(title);
    this.properties = this.properties || {};
    this.connections = [];
    this.addInput("", "*");
    this.addOutput("Output", "*");
  }

  override clone() {
    const cloned = super.clone();
    return cloned;
  }

  private updateOutputLinks(startNode: TLGraphNode = this) {
    const type = (startNode.constructor as typeof TLGraphNode).type;
    // @ts-ignore
    if (startNode.onConnectionsChainChange) {
      // @ts-ignore
      startNode.onConnectionsChainChange();
    }
    if (startNode === this || type?.includes('Reroute') || type?.includes('Combiner')) {
      for (const output of startNode.outputs) {
        if (!output.links || !output.links.length) continue;
        for (const linkId of output.links) {
          const link: LLink = (app.graph as LGraph).links[linkId]!;
          if (!link) continue;
          const targetNode: TLGraphNode = (app.graph as LGraph).getNodeById(link.target_id)!;
          targetNode && this.updateOutputLinks(targetNode)
        }
      }
    }
  }

  override onConnectionsChange(_type: number, _slotIndex: number, _isConnected: boolean, link_info: LLink, _ioSlot: (INodeOutputSlot | INodeInputSlot)) {
    if (!link_info) return;
    this.stabilizeInputsOutputs();
    // Follow outputs to see if we need to trigger an onConnectionChange.
    this.updateOutputLinks();
  }

  private stabilizeInputsOutputs() {
    for (let index = this.inputs.length - 1; index >= 0; index--) {
      const input = this.inputs[index]!;
      if (!input.link) {
        this.removeInput(index);
      }
    }
    this.addInput('', '*');

    const outputLength = this.outputs[0]?.links?.length || 0;
    if (outputLength > 1) {
      this.outputs[0]!.links!.length = 1;
    }
  }
}


/** Legacy "Combiner" */
class CombinerNode extends CollectorNode {
  static override legacyType = "Node Combiner (rgthree)";
  static override title = "‼️ Node Combiner [DEPRECATED]";

  constructor(title = CombinerNode.title) {
    super(title);

    const note = ComfyWidgets["STRING"](this, "last_seed", ["STRING", { multiline: true }], app).widget;
    note.inputEl.value = 'The Node Combiner has been renamed to Node Collector. You can right-click and select "Update to Node Collector" to attempt to automatically update.';
    note.inputEl.readOnly = true;
    note.inputEl.style.backgroundColor = '#332222';
    note.inputEl.style.fontWeight = 'bold';
    note.inputEl.style.fontStyle = 'italic';
    note.inputEl.style.opacity = '0.8';

		this.getExtraMenuOptions = (_: LGraphCanvas, options: ContextMenuItem[]) => {
      options.splice(options.length - 1, 0,
        {
          content: "‼️ Update to Node Collector",
          callback: (_value: ContextMenuItem, _options: IContextMenuOptions, _event: MouseEvent, _parentMenu: ContextMenu | undefined, _node: TLGraphNode) => {
            updateCombinerToCollector(this);
          }
        }
      );
    }
  }

  override configure(info: SerializedLGraphNode) {
    super.configure(info);
    if (this.title != CombinerNode.title && !this.title.startsWith('‼️')) {
      this.title = '‼️ ' + this.title;
    }
  }
}

  /**
   * Updates a Node Combiner to a Node Collector.
   */
async function updateCombinerToCollector(node: TLGraphNode) {
  if (node.type === CollectorNode.legacyType) {
    // Create a new CollectorNode.
    const newNode = new CollectorNode();
    if (node.title != CombinerNode.title) {
      newNode.title = node.title.replace('‼️ ', '');
    }
    // Port the position, size, and properties from the old node.
    newNode.pos = [...node.pos];
    newNode.size = [...node.size];
    newNode.properties = {...node.properties};
    // We now collect the links data, inputs and outputs, of the old node since these will be
    // lost when we remove it.
    const links: any[] = [];
    for (const [index, output] of node.outputs.entries()) {
      for (const linkId of (output.links || [])) {
        const link: LLink = (app.graph as LGraph).links[linkId]!;
        if (!link) continue;
        const targetNode = app.graph.getNodeById(link.target_id);
        links.push({node: newNode, slot: index, targetNode, targetSlot: link.target_slot});
      }
    }
    for (const [index, input] of node.inputs.entries()) {
      const linkId = input.link;
      if (linkId) {
        const link: LLink = (app.graph as LGraph).links[linkId]!;
        const originNode = app.graph.getNodeById(link.origin_id);
        links.push({node: originNode, slot: link.origin_slot, targetNode: newNode, targetSlot: index});
      }
    }
    // Add the new node, remove the old node.
    app.graph.add(newNode);
    await wait();
    // Now go through and connect the other nodes up as they were.
    for (const link of links) {
      link.node.connect(link.slot, link.targetNode, link.targetSlot);
    }
    await wait();
    app.graph.remove(node);
  }
}

app.registerExtension({
	name: "rgthree.NodeCollector",
	registerCustomNodes() {
    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(CollectorNode, app, [['Left','Right'],['Right','Left']]);

		LiteGraph.registerNodeType(CollectorNode.title, CollectorNode);
    CollectorNode.category = CollectorNode._category;
	},
});


app.registerExtension({
	name: "rgthree.NodeCombiner",
	registerCustomNodes() {
    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(CombinerNode, app, [['Left','Right'],['Right','Left']]);

		LiteGraph.registerNodeType(CombinerNode.legacyType, CombinerNode);
    CombinerNode.category = CombinerNode._category;
	},
});

