// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import type {Vector2, LLink, LGraph, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from './typings/litegraph.js';
import { addConnectionLayoutSupport, addMenuItem } from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

const MUTE_MODE = 2;
const ALWAYS_MODE = 0;


app.registerExtension({
	name: "rgthree.Muter",
	registerCustomNodes() {
		class MuterNode extends LGraphNode {

			static override title = "Fast Muter (rgthree)";
      // `category` seems to get reset at register, so we'll
      // re-reset it after the register call. ¯\_(ツ)_/¯
      static category = 'rgthree';
      static _category = 'rgthree';
			static collapsible = false;
      debouncer: number = 0;
      schedulePromise: Promise<void> | null = null;
      isVirtualNode = true;

			constructor(title = MuterNode.title) {
        super(title);
        this.properties = this.properties || {};
        this.connections = [];
				this.addInput("", "*");
      }

      private doChainLookup(startNode: TLGraphNode = this) {
        let rootNodes: TLGraphNode[] = [];
        const type = (startNode.constructor as typeof TLGraphNode).type;
        if (startNode === this || type?.includes('Reroute') || type?.includes('Combiner')) {
          for (const input of startNode.inputs) {
            const linkId: number | null = input!.link;
            if (!linkId) {
              continue;
            }
            const link: LLink = (app.graph as LGraph).links[linkId]!;
            const originNode: TLGraphNode = (app.graph as LGraph).getNodeById(link.origin_id)!;
            const foundNodes = this.doChainLookup(originNode);
            rootNodes = rootNodes.concat(foundNodes);
          }
        } else if (!type?.includes('Reroute') && !type?.includes('Combiner')) {
          // We found our node.
          rootNodes.push(startNode);
        }
        return rootNodes;
      }

      scheduleRefreshMutables() {
        if (!this.schedulePromise) {
          this.schedulePromise = new Promise((resolve) => {
            setTimeout(() => {
              resolve(this.refreshMutables());
              this.schedulePromise = null;
            }, 100);
          });
        }
        return this.schedulePromise;
      }

      refreshMutables() {
        this.stabilizeInputsOutputs();
        const mutables = this.doChainLookup();
        for (const [index, node] of mutables.entries()) {
          let widget = this.widgets && this.widgets[index];
          if (!widget) {
            widget = this.addWidget("toggle", 'title', false, '', {"on": 'yes', "off": 'no'});
          }
          const muted = node.mode === MUTE_MODE;
          widget.name = `Enable ${node.title}`;
          widget.value = !muted;
          widget.callback = () => {
            const muted = node.mode === MUTE_MODE;
            node.mode = muted ? ALWAYS_MODE : MUTE_MODE;
            widget!.value = muted;
          }
        }
        this.widgets.length = mutables.length;
        app.graph.setDirtyCanvas(true, true);
      }

      onConnectionsChainChange() {
        this.scheduleRefreshMutables();
      }

			override onConnectionsChange(_type: number, _index: number, _connected: boolean, _linkInfo: LLink, _ioSlot: (INodeOutputSlot | INodeInputSlot)) {
        this.scheduleRefreshMutables();
      }

      private stabilizeInputsOutputs() {
        for (let index = this.inputs.length - 1; index >= 0; index--) {
          const input = this.inputs[index]!;
          if (!input.link) {
            this.removeInput(index);
          }
        }
        this.addInput('', '*');
      }

      override computeSize(out: Vector2) {
        let size = super.computeSize(out);
        // If we're collapsed, then subtract the total calculated height of the other input slots.
        if (this.properties['collapse_connections']) {
          const rows = Math.max(this.inputs?.length || 0, this.outputs?.length || 0, 1) - 1;
          size[1] = size[1] - (rows * LiteGraph.NODE_SLOT_HEIGHT);
        }
        setTimeout(() => {
          app.graph.setDirtyCanvas(true, true);
        }, 16);
        return size;
      }
		}

    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(MuterNode, app, [['Left'],['Right']]);

    // @ts-ignore: Fix incorrect litegraph typings.
    addMenuItem(MuterNode, app, {
      name: (node) => (`${node.properties?.['collapse_connections'] ? 'Show' : 'Collapse'} Connections`),
      property: 'collapse_connections',
      prepareValue: (_value, node) => !node.properties?.['collapse_connections'],
      callback: (_node) => {app.graph.setDirtyCanvas(true, true)}
    });

    // @ts-ignore: Fix incorrect litegraph typings.
    addMenuItem(MuterNode, app, {
      name: 'Refresh',
      callback: (node) => {(node as MuterNode).scheduleRefreshMutables()}
    });

		LiteGraph.registerNodeType(MuterNode.title, MuterNode);
    MuterNode.category = MuterNode._category;
	},
});
