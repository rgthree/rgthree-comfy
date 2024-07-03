// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {BaseFastGroupsModeChanger} from './fast_groups_muter.js';
import {
  type LiteGraph as TLiteGraph,
  type LGraph as TLGraph,
  type LGraphCanvas as TLGraphCanvas,
  LGraphGroup,
  Vector4,
} from "typings/litegraph.js";
import { groupHasActiveNode, sortBy } from "./utils_fast.js";

declare const LiteGraph: typeof TLiteGraph;

/**
 * A service that keeps global state that can be shared by multiple FastGroupsMuter or
 * FastGroupsBypasser nodes rather than calculate it on it's own.
 */
class FastGroupsService {
  private msThreshold = 400;
  private msLastUnsorted = 0;
  private msLastAlpha = 0;
  private msLastPosition = 0;

  private groupsUnsorted: LGraphGroup[] = [];
  private groupsSortedAlpha: LGraphGroup[] = [];
  private groupsSortedPosition: LGraphGroup[] = [];

  private readonly fastGroupNodes: BaseFastGroupsModeChanger[] = [];

  private runScheduledForMs: number | null = null;
  private runScheduleTimeout: number | null = null;
  private runScheduleAnimation: number | null = null;

  private cachedNodeBoundings: { [key: number]: Vector4 } | null = null;

  constructor() {
    // Don't need to do anything, wait until a signal.
  }

  addFastGroupNode(node: BaseFastGroupsModeChanger) {
    this.fastGroupNodes.push(node);
    // Schedule it because the node may not be ready to refreshWidgets (like, when added it may
    // not have cloned properties to filter against, etc.).
    this.scheduleRun(8);
  }

  removeFastGroupNode(node: BaseFastGroupsModeChanger) {
    const index = this.fastGroupNodes.indexOf(node);
    if (index > -1) {
      this.fastGroupNodes.splice(index, 1);
    }
    // If we have no more group nodes, then clear out data; it could be because of a canvas clear.
    if (!this.fastGroupNodes?.length) {
      this.clearScheduledRun();
      this.groupsUnsorted = [];
      this.groupsSortedAlpha = [];
      this.groupsSortedPosition = [];
    }
  }

  private run() {
    // We only run if we're scheduled, so if we're not, then bail.
    if (!this.runScheduledForMs) {
      return;
    }
    for (const node of this.fastGroupNodes) {
      node.refreshWidgets();
    }
    this.clearScheduledRun();
    this.scheduleRun();
  }

  private scheduleRun(ms = 500) {
    // If we got a request for an immediate schedule and already have on scheduled for longer, then
    // cancel the long one to expediate a fast one.
    if (this.runScheduledForMs && ms < this.runScheduledForMs) {
      this.clearScheduledRun();
    }
    if (!this.runScheduledForMs && this.fastGroupNodes.length) {
      this.runScheduledForMs = ms;
      this.runScheduleTimeout = setTimeout(() => {
        this.runScheduleAnimation = requestAnimationFrame(() => this.run());
      }, ms);
    }
  }

  private clearScheduledRun() {
    this.runScheduleTimeout && clearTimeout(this.runScheduleTimeout);
    this.runScheduleAnimation && cancelAnimationFrame(this.runScheduleAnimation);
    this.runScheduleTimeout = null;
    this.runScheduleAnimation = null;
    this.runScheduledForMs = null;
  }

  /**
   * Returns the boundings for all nodes on the graph, then clears it after a short delay. This is
   * to increase efficiency by caching the nodes' boundings when multiple groups are on the page.
   */
  getBoundingsForAllNodes() {
    if (!this.cachedNodeBoundings) {
      this.cachedNodeBoundings = {};
      for (const node of app.graph._nodes) {
        this.cachedNodeBoundings[node.id] = node.getBounding();
      }
      setTimeout(() => {
        this.cachedNodeBoundings = null;
      }, 50);
    }
    return this.cachedNodeBoundings;
  }

  /**
   * This overrides `LGraphGroup.prototype.recomputeInsideNodes` to be much more efficient when
   * calculating for many groups at once (only compute all nodes once in `getBoundingsForAllNodes`).
   */
  recomputeInsideNodesForGroup(group: LGraphGroup) {
    const cachedBoundings = this.getBoundingsForAllNodes();
    const nodes = group.graph._nodes;
    group._nodes.length = 0;

    for (const node of nodes) {
      const node_bounding = cachedBoundings[node.id];
      if (!node_bounding || !LiteGraph.overlapBounding(group._bounding, node_bounding)) {
        continue;
      }
      group._nodes.push(node);
    }
  }

  /**
   * Everything goes through getGroupsUnsorted, so we only get groups once. However, LiteGraph's
   * `recomputeInsideNodes` is inefficient when calling multiple groups (it iterates over all nodes
   * each time). So, we'll do our own dang thing, once.
   */
  private getGroupsUnsorted(now: number) {
    const canvas = app.canvas as TLGraphCanvas;
    const graph = app.graph as TLGraph;

    if (
      // Don't recalculate nodes if we're moving a group (added by ComfyUI in app.js)
      !canvas.selected_group_moving &&
      (!this.groupsUnsorted.length || now - this.msLastUnsorted > this.msThreshold)
    ) {
      this.groupsUnsorted = [...graph._groups];
      for (const group of this.groupsUnsorted) {
        this.recomputeInsideNodesForGroup(group);
        const _ = groupHasActiveNode(group);
      }
      this.msLastUnsorted = now;
    }
    return this.groupsUnsorted;
  }

  private getGroupsAlpha(now: number) {
    if (!this.groupsSortedAlpha.length || now - this.msLastAlpha > this.msThreshold) {
      this.groupsSortedAlpha = sortBy(this.getGroupsUnsorted(now), { sort: "alphanumeric" });
      this.msLastAlpha = now;
    }
    return this.groupsSortedAlpha;
  }

  private getGroupsPosition(now: number) {
    if (!this.groupsSortedPosition.length || now - this.msLastPosition > this.msThreshold) {
      this.groupsSortedPosition = sortBy(this.getGroupsUnsorted(now), { sort: "position" });
      this.msLastPosition = now;
    }
    return this.groupsSortedPosition;
  }

  getGroups(sort?: string) {
    const now = +new Date();
    switch (sort) {
      case "alphanumeric":
        return this.getGroupsAlpha(now);
      case "position":
        return this.getGroupsPosition(now);
      default:
        return this.getGroupsUnsorted(now);
    }
  }
}

/** The FastGroupsService singleton. */
export const SERVICE = new FastGroupsService();
