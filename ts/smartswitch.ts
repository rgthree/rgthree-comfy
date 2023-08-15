/**
 * This one would be cool, but the server doesn't like it. Would need to patch ComfyUi
 * to allow a "trust me" input type in its graph checking.
 */

// // @ts-ignore
// import {app} from "../../scripts/app.js";
// import type {Vector2, LLink, SerializedLGraphNode, ContextMenuItem, IContextMenuOptions, ContextMenu, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from './typings/litegraph.js';
// import type {ComfyObjectInfo, ComfyApp} from './typings/comfy.js'

// declare const LiteGraph: typeof TLiteGraph;
// declare const LGraphNode: typeof TLGraphNode;

// app.registerExtension({
// 	name: "rgthree.SmartSwitch",
// 	async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyObjectInfo, app: ComfyApp) {
// 		if (nodeData.name === "Smart Switch (rgthree)") {
//       console.log(nodeData);
//       console.dir(nodeType);

// 			const onNodeCreated = nodeType.prototype.onNodeCreated;
// 			nodeType.prototype.onNodeCreated = function () {
// 				const r = onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

//         // Add the initial input
//         if (!this.inputs || !this.inputs.length) {
// 				  this.addInput("", "*");
//           this.outputs[0].name = '';
//         }

//       }

// 			const onConnectionsChange = nodeType.prototype.onConnectionsChange;

// 			nodeType.prototype.onConnectionsChange = function(type: number, slotIndex: number, isConnected: boolean, link_info: LLink, ioSlot: (INodeOutputSlot | INodeInputSlot)) {
// 				const r = onConnectionsChange ? onConnectionsChange.apply(this, [type, slotIndex, isConnected, link_info,ioSlot]) : undefined;
//         if (!link_info) {
//           return;
//         }
//         console.log(type, index, connected, link_info);
//         if (type === 1) {
//           if (connected) {
//             const connectedOutput = app.graph.getNodeById(link_info.origin_id).outputs[link_info.origin_slot];
//             console.log(connectedOutput);
//             if (this.inputs.length === 1) {
//               this.inputs[0].name = connectedOutput.type.toLowerCase() + '_1';
//               this.inputs[0].type = connectedOutput.type;
//               // Add an output of the same type.
//               this.outputs[0].name = this.inputs[0].type;
//               this.outputs[0].type = this.inputs[0].type;
//             }
//             // Add another input of the same type.
//             this.addInput(`${connectedOutput.type.toLowerCase()}_${index+2}`, this.inputs[0].type);
//           } else {
//             this.inputs.splice(index, 1);
//             // If we removed the last input and there's no outputs, then clear.
//             if (this.inputs.length === 1 && !this.outputs[0].links.length) {
//               this.inputs[0].name = '';
//               this.inputs[0].type = '*';
//               this.outputs[0].name = '';
//               this.outputs[0].type = '*';
//             }
//           }
//         } else if (type === 2) {
//           if (connected && this.inputs[0].type === '*') {
//             const connectedInput = app.graph.getNodeById(link_info.target_id).outputs[link_info.target_slot];
//             this.inputs[0].name = connectedInput.type.toLowerCase() + '_1';
//             this.inputs[0].type = connectedInput.type;
//             this.outputs[0].name = this.inputs[0].type;
//             this.outputs[0].type = this.inputs[0].type;

//           // If we removed the ouput and there's no connected inputs, then clear.
//           } else if (!connected && this.inputs.length === 1 && this.inputs[0].links.length) {
//             this.inputs[0].name = '';
//             this.inputs[0].type = '*';
//             this.outputs[0].name = '';
//             this.outputs[0].type = '*';
//           }
//         }
//       }
// 		}
// 	},
// });