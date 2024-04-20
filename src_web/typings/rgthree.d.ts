import type { AdjustedMouseEvent, LGraphNode, Vector2 } from "./litegraph";
import type {Constructor} from "./index";
import type {RgthreeBaseVirtualNode} from '../comfyui/base_node.js'

export type AdjustedMouseCustomEvent = CustomEvent<{ originalEvent: AdjustedMouseEvent }>;


export interface RgthreeBaseVirtualNodeConstructor extends Constructor<RgthreeBaseVirtualNode> {
	static type: string;
	static category: string;
	static _category: string;
}


export interface RgthreeBaseServerNodeConstructor extends Constructor<RgthreeBaseServerNode> {
	static nodeType: ComfyNodeConstructor;
	static nodeData: ComfyObjectInfo;
	static __registeredForOverride__: boolean;
  onRegisteredForOverride(comfyClass: any, rgthreeClass: any) : void;
}
