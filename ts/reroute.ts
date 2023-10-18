// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import {rgthreeConfig} from "./rgthree_config.js";
import { rgthree } from "./rgthree.js";
import type {
  Vector2,
  LLink,
  LGraphCanvas as TLGraphCanvas,
  LGraph,
  SerializedLGraphNode,
  INodeInputSlot,
  INodeOutputSlot,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
} from "./typings/litegraph.js";
import {
  LAYOUT_CLOCKWISE,
  LAYOUT_LABEL_OPPOSITES,
  LAYOUT_LABEL_TO_DATA,
  addConnectionLayoutSupport,
  addMenuItem,
  getSlotLinks,
  isValidConnection,
} from "./utils.js";
import { wait } from "./shared_utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;
declare const LGraphCanvas: typeof TLGraphCanvas;

const rerouteConfig = rgthreeConfig?.['nodes']?.['reroute'] || {};
let configWidth = Math.max(Math.round((Number(rerouteConfig['default_width']) || 40) / 10) * 10, 10);
let configHeight = Math.max(Math.round((Number(rerouteConfig['default_height']) || 30) / 10) * 10, 10);
// Don't allow too small sizes. Granted, 400 is too small, but at least you can right click and
// resize... 10x10 you cannot.
while(configWidth * configHeight < 400) {
  configWidth += 10;
  configHeight += 10;
}
const configDefaultSize = [configWidth, configHeight] as Vector2;
const configResizable = !!rerouteConfig['default_resizable'];
let configLayout: [string, string] = rerouteConfig['default_layout'];
if (!Array.isArray(configLayout)) {
  configLayout = ['Left', 'Right'];
}
if (!LAYOUT_LABEL_TO_DATA[configLayout[0]]) {
  configLayout[0] = 'Left';
}
if (!LAYOUT_LABEL_TO_DATA[configLayout[1]] || configLayout[0] == configLayout[1]) {
  configLayout[1] = LAYOUT_LABEL_OPPOSITES[configLayout[0]]!;
}

app.registerExtension({
  name: "rgthree.Reroute",
  registerCustomNodes() {

    class RerouteNode extends LGraphNode {
      static override title = "Reroute (rgthree)";
      // `category` seems to get reset at register, so we'll
      // re-reset it after the register call. ¯\_(ツ)_/¯
      static category = "rgthree";
      static _category = "rgthree";
      static readonly title_mode = LiteGraph.NO_TITLE;
      static collapsable = false;
      static layout_slot_offset = 5;
      static size: Vector2 = configDefaultSize; // Starting size, read from within litegraph.core

      readonly isVirtualNode?: boolean;
      readonly hideSlotLabels: boolean;

      private configuring = true;
      private schedulePromise: Promise<void> | null = null;

      defaultConnectionsLayout = configLayout;

      constructor(title = RerouteNode.title) {
        super(title);
        this.isVirtualNode = true;
        this.hideSlotLabels = true;
        this.setResizable(this.properties['resizable'] ?? configResizable);
        this.size = RerouteNode.size; // Starting size.
        this.addInput("", "*");
        this.addOutput("", "*");
        setTimeout(() => this.applyNodeSize(), 20);
      }

      override configure(info: SerializedLGraphNode) {
        this.configuring = true;
        super.configure(info);
        this.setResizable(this.properties['resizable'] ?? configResizable);
        this.applyNodeSize();
        this.configuring = false;
      }

      setResizable(resizable: boolean) {
        this.properties['resizable'] = !!resizable;
        this.resizable = this.properties['resizable'];
      }

      override clone() {
        const cloned = super.clone();
        cloned.inputs[0]!.type = "*";
        cloned.outputs[0]!.type = "*";
        return cloned;
      }

      /**
       * Copied a good bunch of this from the original reroute included with comfy.
       */
      override onConnectionsChange(
        type: number,
        _slotIndex: number,
        connected: boolean,
        _link_info: LLink,
        _ioSlot: INodeOutputSlot | INodeInputSlot,
      ) {
        // Prevent multiple connections to different types when we have no input
        if (connected && type === LiteGraph.OUTPUT) {
          // Ignore wildcard nodes as these will be updated to real types
          const types = new Set(
            this.outputs[0]!.links!.map((l) => app.graph.links[l].type).filter(
              (t) => t !== "*",
            ),
          );
          if (types.size > 1) {
            const linksToDisconnect = [];
            for (let i = 0; i < this.outputs[0]!.links!.length - 1; i++) {
              const linkId = this.outputs[0]!.links![i];
              const link = app.graph.links[linkId];
              linksToDisconnect.push(link);
            }
            for (const link of linksToDisconnect) {
              const node = app.graph.getNodeById(link.target_id);
              node.disconnectInput(link.target_slot);
            }
          }
        }
        this.scheduleStabilize();
      }

      override onDrawForeground(ctx: CanvasRenderingContext2D, canvas: TLGraphCanvas): void {
        if (this.properties?.['showLabel']) {
          const low_quality = canvas.ds.scale < 0.6;
          if (low_quality || this.size[0] <= 10) {
            return;
          }
          const fontSize = Math.min(14, ((this.size[1] * 0.65)|0));
          ctx.save();
          ctx.fillStyle = "#888";
          ctx.font =  `${fontSize}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(this.title && this.title !== RerouteNode.title ? this.title : this.outputs?.[0]?.type || ''), this.size[0] / 2, (this.size[1] / 2), this.size[0] - 30);
          ctx.restore();
        }
      }

      override disconnectOutput(slot: string | number, targetNode?: TLGraphNode | undefined): boolean {
        return super.disconnectOutput(slot, targetNode);
      }


      scheduleStabilize(ms = 64) {
        if (!this.schedulePromise) {
          this.schedulePromise = new Promise((resolve) => {
            setTimeout(() => {
              this.schedulePromise = null
              this.stabilize();
              resolve();
            }, ms);
          });
        }
        return this.schedulePromise;
      }

      stabilize() {
        // If we are currently "configuring" then skip this stabilization. The connected nodes may
        // not yet be configured.
        if (this.configuring) {
          return;
        }
        // Find root input
        let currentNode: TLGraphNode | null = this;
        let updateNodes = [];
        let input = null;
        let inputType = null;
        let inputNode = null;
        let inputNodeOutputSlot = null;
        while (currentNode) {
          updateNodes.unshift(currentNode);
          const linkId: number | null = currentNode.inputs[0]!.link;
          if (linkId !== null) {
            const link: LLink = (app.graph as LGraph).links[linkId]!;
            const node: TLGraphNode = (app.graph as LGraph).getNodeById(
              link.origin_id,
            )!;
            if (!node) {
              // Bummer, somthing happened.. should we cleanup?
              app.graph.removeLink(linkId)
              currentNode = null;
              break;
            }
            const type = (node.constructor as typeof TLGraphNode).type;
            if (type?.includes("Reroute")) {
              if (node === this) {
                // We've found a circle
                currentNode.disconnectInput(link.target_slot);
                currentNode = null;
              } else {
                // Move the previous node
                currentNode = node;
              }
            } else {
              // We've found the end
              inputNode = node;
              inputNodeOutputSlot = link.origin_slot;
              input = node.outputs[inputNodeOutputSlot] ?? null;
              inputType = input?.type ?? null;
              break;
            }
          } else {
            // This path has no input node
            currentNode = null;
            break;
          }
        }

        // Find all outputs
        const nodes: TLGraphNode[] = [this];
        let outputNode = null;
        let outputType = null;
        while (nodes.length) {
          currentNode = nodes.pop()!;
          const outputs =
            (currentNode.outputs ? currentNode.outputs[0]!.links : []) || [];
          if (outputs.length) {
            for (const linkId of outputs) {
              const link = app.graph.links[linkId];

              // When disconnecting sometimes the link is still registered
              if (!link) continue;

              const node = app.graph.getNodeById(link.target_id) as TLGraphNode;
              // Don't know why this ever happens.. but it did around the repeater..
              if (!node) continue;
              const type = (node.constructor as any).type;
              if (type?.includes("Reroute")) {
                // Follow reroute nodes
                nodes.push(node);
                updateNodes.push(node);
              } else {
                // We've found an output
                const output = node.inputs?.[link.target_slot] ?? null;
                const nodeOutType = output?.type;
                if (nodeOutType == null) {
                  console.warn(`[rgthree] Reroute - Connected node ${node.id} does not have type information for slot ${link.target_slot}. Skipping connection enforcement, but something is odd with that node.`);
                } else if (
                  inputType &&
                  inputType !== "*" &&
                  nodeOutType !== "*" &&
                  !isValidConnection(input, output)
                ) {
                  // The output doesnt match our input so disconnect it
                  console.warn(`[rgthree] Reroute - Disconnecting connected node's input (${node.id}.${link.target_slot}) (${node.type}) because its type (${String(nodeOutType)}) does not match the reroute type (${String(inputType)})`);
                  node.disconnectInput(link.target_slot);
                } else {
                  outputType = nodeOutType;
                  outputNode = node;
                }
              }
            }
          } else {
            // No more outputs for this path
          }
        }

        const displayType = inputType || outputType || "*";
        const color = LGraphCanvas.link_type_colors[displayType];

        // Update the types of each node
        for (const node of updateNodes) {
          // If we dont have an input type we are always wildcard but we'll show the output type
          // This lets you change the output link to a different type and all nodes will update
          node.outputs[0]!.type = inputType || "*";
          (node as any).__outputType = displayType;
          node.outputs[0]!.name = input?.name || "";
          node.size = node.computeSize();
          (node as any).applyNodeSize?.();

          for (const l of node.outputs[0]!.links || []) {
            const link = app.graph.links[l];
            if (link) {
              link.color = color;
            }
          }
        }

        if (inputNode && inputNodeOutputSlot != null) {
          const links = inputNode.outputs[inputNodeOutputSlot]!.links;
          for (const l of links || []) {
            const link = app.graph.links[l];
            if (link) {
              link.color = color;
            }
          }
        }
        (inputNode as any)?.onConnectionsChainChange?.();
        (outputNode as any)?.onConnectionsChainChange?.();
        app.graph.setDirtyCanvas(true, true);
      }

      override computeSize(out?: Vector2 | undefined): Vector2 {
        // Secret funcionality for me that I don't want to explain. Hold down ctrl while dragging
        // to allow 10,10 dragging size.
        if (app.canvas.resizing_node?.id === this.id && rgthree.ctrlKey) {
          return [10, 10];
        }
        return super.computeSize(out);
      }

      override onResize(size: Vector2) {
        // If the canvas is currently resizing our node, then we want to save it to our properties.
        if (app.canvas.resizing_node?.id === this.id) {
          this.properties["size"] = [
            size[0],
            size[1],
          ];
          // If we end up resizing under the minimum size (like, we're holding down the secret crtl)
          // then let's no longer make us resizable. When we let go.
          if (size[0] < 40 || size[0] < 30) {
            this.setResizable(false);
          }
        }
        if (super.onResize) {
          super.onResize(size);
        }
      }

      applyNodeSize() {
        this.properties["size"] = this.properties["size"] || RerouteNode.size;
        this.properties["size"] = [
          Number(this.properties["size"][0]),
          Number(this.properties["size"][1]),
        ];
        this.size = this.properties["size"];
        app.graph.setDirtyCanvas(true, true);
      }
    }

    addMenuItem(RerouteNode, app, {
      name: (node) => `${node.properties?.['showLabel'] ? "Hide" : "Show"} Label/Title`,
      property: 'showLabel',
      callback: async (node, value) => {
        app.graph.setDirtyCanvas(true, true);
      },
    });

    addMenuItem(RerouteNode, app, {
      name: (node) => `${node.resizable ? 'No' : 'Allow'} Resizing`,
      callback: (node) => {
        (node as RerouteNode).setResizable(!node.resizable);
        node.size[0] = Math.max(40, node.size[0]);
        node.size[1] = Math.max(30, node.size[1]);
        (node as RerouteNode).applyNodeSize();
      },
    });

    addMenuItem(RerouteNode, app, {
      name: "Static Width",
      property: "size",
      subMenuOptions: (() => {
        const options = [];
        for (let w = 8; w > 0; w--) {
          options.push(`${w * 10}`);
        }
        return options;
      })(),
      prepareValue: (value, node) => [Number(value), node.size[1]],
      callback: (node) => {
        (node as RerouteNode).setResizable(false);
        (node as RerouteNode).applyNodeSize();
      },
    });

    addMenuItem(RerouteNode, app, {
      name: "Static Height",
      property: "size",
      subMenuOptions: (() => {
        const options = [];
        for (let w = 8; w > 0; w--) {
          options.push(`${w * 10}`);
        }
        return options;
      })(),
      prepareValue: (value, node) => [node.size[0], Number(value)],
      callback: (node) => {
        (node as RerouteNode).setResizable(false);
        (node as RerouteNode).applyNodeSize();
      },
    });

    addConnectionLayoutSupport(
      RerouteNode,
      app,
      [
        ["Left", "Right"],
        ["Left", "Top"],
        ["Left", "Bottom"],
        ["Right", "Left"],
        ["Right", "Top"],
        ["Right", "Bottom"],
        ["Top", "Left"],
        ["Top", "Right"],
        ["Top", "Bottom"],
        ["Bottom", "Left"],
        ["Bottom", "Right"],
        ["Bottom", "Top"],
      ],
      (node) => {
        (node as RerouteNode).applyNodeSize();
      },
    );

    addMenuItem(RerouteNode, app, {
      name: "Rotate",
      subMenuOptions: [
        "Rotate 90° Clockwise",
        "Rotate 90° Counter-Clockwise",
        "Rotate 180°",
        null,
        "Flip Horizontally",
        "Flip Vertically",
      ],
      callback: (node, value) => {
        const w = node.size[0];
        const h = node.size[1];
        node.properties["connections_layout"] = node.properties[
          "connections_layout"
        ] || (node as RerouteNode).defaultConnectionsLayout;
        const inputDirIndex = LAYOUT_CLOCKWISE.indexOf(
          node.properties["connections_layout"][0],
        );
        const outputDirIndex = LAYOUT_CLOCKWISE.indexOf(
          node.properties["connections_layout"][1],
        );
        if (value?.startsWith("Rotate 90°")) {
          node.size[0] = h;
          node.size[1] = w;
          if (value.includes("Counter")) {
            node.properties["connections_layout"][0] =
              LAYOUT_CLOCKWISE[(((inputDirIndex - 1) % 4) + 4) % 4];
            node.properties["connections_layout"][1] =
              LAYOUT_CLOCKWISE[(((outputDirIndex - 1) % 4) + 4) % 4];
          } else {
            node.properties["connections_layout"][0] =
              LAYOUT_CLOCKWISE[(((inputDirIndex + 1) % 4) + 4) % 4];
            node.properties["connections_layout"][1] =
              LAYOUT_CLOCKWISE[(((outputDirIndex + 1) % 4) + 4) % 4];
          }
        } else if (value?.startsWith("Rotate 180°")) {
          node.properties["connections_layout"][0] =
            LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
          node.properties["connections_layout"][1] =
            LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
        } else if (value?.startsWith("Flip Horizontally")) {
          if (
            ["Left", "Right"].includes(node.properties["connections_layout"][0])
          ) {
            node.properties["connections_layout"][0] =
              LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
          }
          if (
            ["Left", "Right"].includes(node.properties["connections_layout"][1])
          ) {
            node.properties["connections_layout"][1] =
              LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
          }
        } else if (value?.startsWith("Flip Vertically")) {
          if (
            ["Top", "Bottom"].includes(node.properties["connections_layout"][0])
          ) {
            node.properties["connections_layout"][0] =
              LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
          }
          if (
            ["Top", "Bottom"].includes(
              node.properties["connections_layout"][1],
            )
          ) {
            node.properties["connections_layout"][1] =
              LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
          }
        }
      },
    });


    addMenuItem(RerouteNode, app, {
      name: "Clone New Reroute...",
      subMenuOptions: [
        "Before",
        "After",
      ],
      callback: async (node, value) => {
        const clone = node.clone();
        const pos = [...node.pos];
        if (value === 'Before') {
          clone.pos = [pos[0]! - 20, pos[1]! - 20];
          app.graph.add(clone);
          await wait();
          const inputLinks = getSlotLinks(node.inputs[0]);
          for (const inputLink of inputLinks) {
            const link = inputLink.link;
            const linkedNode = app.graph.getNodeById(link.origin_id) as TLGraphNode;
            if (linkedNode) {
              linkedNode.connect(0, clone, 0);
            }
          }
          clone.connect(0, node, 0);
        } else {
          clone.pos = [pos[0]! + 20, pos[1]! + 20];
          app.graph.add(clone);
          await wait();
          const outputLinks = getSlotLinks(node.outputs[0]);
          node.connect(0, clone, 0);
          for (const outputLink of outputLinks) {
            const link = outputLink.link;
            const linkedNode = app.graph.getNodeById(link.target_id) as TLGraphNode;
            if (linkedNode) {
              clone.connect(0, linkedNode, link.target_slot);
            }
          }
        }
      },
    });

    LiteGraph.registerNodeType(RerouteNode.title, RerouteNode);
    RerouteNode.category = RerouteNode._category;
  },
});
