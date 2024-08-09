import { LGraph } from "./litegraph.js";

export type Constructor<T> = new(...args: any[]) => T;

export type SerializedLink = [
  number, // this.id,
  number, // this.origin_id,
  number, // this.origin_slot,
  number, // this.target_id,
  number, // this.target_slot,
  string, // this.type
];

export interface SerializedNodeInput {
  name: string;
  type: string;
  link: number;
}
export interface SerializedNodeOutput {
  name: string;
  type: string;
  link: number;
  slot_index: number;
  links: number[];
}
export interface SerializedNode {
  id: number;
  inputs: SerializedNodeInput[];
  outputs: SerializedNodeOutput[];
  mode: number;
  order: number;
  pos: [number, number];
  properties: any;
  size: [number, number];
  type: string;
  widgets_values: Array<number | string>;
}

export interface SerializedGraph {
  config: any;
  extra: any;
  groups: any;
  last_link_id: number;
  last_node_id: number;
  links: SerializedLink[];
  nodes: SerializedNode[];
}

export interface BadLinksData<T = SerializedGraph|LGraph> {
  hasBadLinks: boolean;
  fixed: boolean;
  graph: T;
  patched: number;
  deleted: number;
}
