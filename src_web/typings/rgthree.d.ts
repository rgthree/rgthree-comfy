import type { AdjustedMouseEvent } from "./litegraph";

export type AdjustedMouseCustomEvent = CustomEvent<{ originalEvent: AdjustedMouseEvent }>;