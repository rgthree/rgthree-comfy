import type { AdjustedMouseEvent } from "./litegraph";

export type AdjustedMouseCustomEvent = CustomEvent<{ originalEvent: AdjustedMouseEvent }>;

export interface RgthreeBaseServerNodeConstructor extends Constructor<RgthreeBaseServerNode> {
	static nodeType: ComfyNodeConstructor;
	static nodeData: ComfyObjectInfo;
	static __registeredForOverride__: boolean;
  onRegisteredForOverride(comfyClass: any, rgthreeClass: any) : void;
}
