import type { LGraphGroup as TLGraphGroup, LGraphNode as TLGraphNode, IWidget, SerializedLGraphNode, LGraph as TLGraph, LGraphCanvas as TLGraphCanvas, LiteGraph as TLiteGraph } from "./litegraph.js";
import type {Constructor, SerializedGraph} from './index.js';

declare global {
  const LiteGraph: typeof TLiteGraph;
	const LGraph: typeof TLGraph;
	const LGraphNode: typeof TLGraphNode;
	const LGraphCanvas: typeof TLGraphCanvas;
	const LGraphGroup: typeof TLGraphGroup;
}

// @rgthree: Types on ComfyApp as needed.
export interface ComfyApp {
	extensions: ComfyExtension[];
	async queuePrompt(number?: number, batchCount = 1): Promise<void>;
	graph: TLGraph;
	canvas: TLGraphCanvas;
	clean() : void;
 	registerExtension(extension: ComfyExtension): void;
	getPreviewFormatParam(): string;
	getRandParam(): string;
	loadApiJson(apiData: {}, fileName: string): void;
	async graphToPrompt(graph?: TLGraph, clean?: boolean): Promise<void>;
	// workflow: ComfyWorkflowInstance ???
	async loadGraphData(graphData: {}, clean?: boolean, restore_view?: boolean, workflow?: any|null): Promise<void>
	ui: {
		settings: {
			addSetting(config: {id: string, name: string, type: () => HTMLElement}) : void;
		}
	}
	// Just marking as any for now.
	menu?: any;
}

export interface ComfyWidget extends IWidget {
	// https://github.com/comfyanonymous/ComfyUI/issues/2193 Changes from SerializedLGraphNode to
	// LGraphNode...
	serializeValue(nodeType: TLGraphNode, index: number): Promise<TValue>;
	afterQueued(): void;
	inputEl?: HTMLTextAreaElement;
	width: number;
}

export interface ComfyGraphNode extends TLGraphNode {
	getExtraMenuOptions: (node: TLGraphNode, options: ContextMenuItem[]) => void;
	onExecuted(message: any): void;
}

export interface ComfyNode extends TLGraphNode {
	comfyClass: string;
}

// @rgthree
export interface ComfyNodeConstructor extends Constructor<ComfyNode> {
	static title: string;
	static type?: string;
	static comfyClass: string;
}

export type NodeMode = 0|1|2|3|4|undefined;


export interface ComfyExtension {
	/**
	 * The name of the extension
	 */
	name: string;
	/**
	 * Allows any initialisation, e.g. loading resources. Called after the canvas is created but before nodes are added
	 * @param app The ComfyUI app instance
	 */
	init?(app: ComfyApp): Promise<void>;
	/**
	 * Allows any additonal setup, called after the application is fully set up and running
	 * @param app The ComfyUI app instance
	 */
	setup?(app: ComfyApp): Promise<void>;
	/**
	 * Called before nodes are registered with the graph
	 * @param defs The collection of node definitions, add custom ones or edit existing ones
	 * @param app The ComfyUI app instance
	 */
	addCustomNodeDefs?(defs: Record<string, ComfyObjectInfo>, app: ComfyApp): Promise<void>;
	/**
	 * Allows the extension to add custom widgets
	 * @param app The ComfyUI app instance
	 * @returns An array of {[widget name]: widget data}
	 */
	getCustomWidgets?(
		app: ComfyApp
	): Promise<
		Record<string, (node, inputName, inputData, app) => { widget?: IWidget; minWidth?: number; minHeight?: number }>
	>;
	/**
	 * Allows the extension to add additional handling to the node before it is registered with LGraph
	 * @rgthree changed nodeType from `typeof LGraphNode` to `ComfyNodeConstructor`
	 * @param nodeType The node class (not an instance)
	 * @param nodeData The original node object info config object
	 * @param app The ComfyUI app instance
	 */
	beforeRegisterNodeDef?(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo, app: ComfyApp): Promise<void>;
	/**
	 * Allows the extension to register additional nodes with LGraph after standard nodes are added
	 * @param app The ComfyUI app instance
	 */
	// @rgthree - add void for non async
	registerCustomNodes?(app: ComfyApp): void|Promise<void>;
	/**
	 * Allows the extension to modify a node that has been reloaded onto the graph.
	 * If you break something in the backend and want to patch workflows in the frontend
	 * This is the place to do this
	 * @param node The node that has been loaded
	 * @param app The ComfyUI app instance
	 */
	loadedGraphNode?(node: TLGraphNode, app: ComfyApp);
	/**
	 * Allows the extension to run code after the constructor of the node
	 * @param node The node that has been created
	 * @param app The ComfyUI app instance
	 */
	nodeCreated?(node: TLGraphNode, app: ComfyApp);
}

export type ComfyObjectInfo = {
	name: string;
	display_name?: string;
	description?: string;
	category: string;
	input?: {
		required?: Record<string, ComfyObjectInfoConfig>;
		optional?: Record<string, ComfyObjectInfoConfig>;
		hidden?: Record<string, ComfyObjectInfoConfig>;
	};
	output?: string[];
	output_name: string[];
	// @rgthree
	output_node?: boolean;
};

export type ComfyObjectInfoConfig = [string | any[]] | [string | any[], any];

// @rgthree
type ComfyApiInputLink = [
  /** The id string of the connected node. */
  string,
  /** The output index. */
  number,
]

// @rgthree
export type ComfyApiFormatNode = {
  "inputs": {
    [input_name: string]: string|number|boolean|ComfyApiInputLink,
  },
  "class_type": string,
  "_meta": {
    "title": string,
  }
}

// @rgthree
export type ComfyApiFormat = {
  [node_id: string]: ComfyApiFormatNode
}

// @rgthree
export type ComfyApiPrompt = {
  workflow: SerializedGraph,
  output: ComfyApiFormat,
}

// @rgthree
export type ComfyApiEventDetailStatus = {
  exec_info: {
    queue_remaining: number;
  };
};

// @rgthree
export type ComfyApiEventDetailExecutionStart = {
  prompt_id: string;
};

// @rgthree
export type ComfyApiEventDetailExecuting = null | string;

// @rgthree
export type ComfyApiEventDetailProgress = {
  node: string;
  prompt_id: string;
  max: number;
  value: number;
};

// @rgthree
export type ComfyApiEventDetailExecuted = {
  node: string;
  prompt_id: string;
  output: any;
};

// @rgthree
export type ComfyApiEventDetailCached = {
  nodes: string[];
  prompt_id: string;
};

// @rgthree
export type ComfyApiEventDetailExecuted = {
  prompt_id: string;
  node: string;
  output: any;
};

// @rgthree
export type ComfyApiEventDetailError = {
  prompt_id: string;
  exception_type: string;
  exception_message: string;
  node_id: string;
  node_type: string;
  node_id: string;
  traceback: string;
  executed: any[];
  current_inputs:  {[key: string]: (number[]|string[])};
  current_outputs: {[key: string]: (number[]|string[])};
}
