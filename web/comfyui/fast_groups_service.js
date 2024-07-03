import { app } from "../../scripts/app.js";
import { groupHasActiveNode, sortBy } from "./utils_fast.js";
class FastGroupsService {
    constructor() {
        this.msThreshold = 400;
        this.msLastUnsorted = 0;
        this.msLastAlpha = 0;
        this.msLastPosition = 0;
        this.groupsUnsorted = [];
        this.groupsSortedAlpha = [];
        this.groupsSortedPosition = [];
        this.fastGroupNodes = [];
        this.runScheduledForMs = null;
        this.runScheduleTimeout = null;
        this.runScheduleAnimation = null;
        this.cachedNodeBoundings = null;
    }
    addFastGroupNode(node) {
        this.fastGroupNodes.push(node);
        this.scheduleRun(8);
    }
    removeFastGroupNode(node) {
        var _a;
        const index = this.fastGroupNodes.indexOf(node);
        if (index > -1) {
            this.fastGroupNodes.splice(index, 1);
        }
        if (!((_a = this.fastGroupNodes) === null || _a === void 0 ? void 0 : _a.length)) {
            this.clearScheduledRun();
            this.groupsUnsorted = [];
            this.groupsSortedAlpha = [];
            this.groupsSortedPosition = [];
        }
    }
    run() {
        if (!this.runScheduledForMs) {
            return;
        }
        for (const node of this.fastGroupNodes) {
            node.refreshWidgets();
        }
        this.clearScheduledRun();
        this.scheduleRun();
    }
    scheduleRun(ms = 500) {
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
    clearScheduledRun() {
        this.runScheduleTimeout && clearTimeout(this.runScheduleTimeout);
        this.runScheduleAnimation && cancelAnimationFrame(this.runScheduleAnimation);
        this.runScheduleTimeout = null;
        this.runScheduleAnimation = null;
        this.runScheduledForMs = null;
    }
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
    recomputeInsideNodesForGroup(group) {
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
    getGroupsUnsorted(now) {
        const canvas = app.canvas;
        const graph = app.graph;
        if (!canvas.selected_group_moving &&
            (!this.groupsUnsorted.length || now - this.msLastUnsorted > this.msThreshold)) {
            this.groupsUnsorted = [...graph._groups];
            for (const group of this.groupsUnsorted) {
                this.recomputeInsideNodesForGroup(group);
                const _ = groupHasActiveNode(group);
            }
            this.msLastUnsorted = now;
        }
        return this.groupsUnsorted;
    }
    getGroupsAlpha(now) {
        if (!this.groupsSortedAlpha.length || now - this.msLastAlpha > this.msThreshold) {
            this.groupsSortedAlpha = sortBy(this.getGroupsUnsorted(now), { sort: "alphanumeric" });
            this.msLastAlpha = now;
        }
        return this.groupsSortedAlpha;
    }
    getGroupsPosition(now) {
        if (!this.groupsSortedPosition.length || now - this.msLastPosition > this.msThreshold) {
            this.groupsSortedPosition = sortBy(this.getGroupsUnsorted(now), { sort: "position" });
            this.msLastPosition = now;
        }
        return this.groupsSortedPosition;
    }
    getGroups(sort) {
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
export const SERVICE = new FastGroupsService();
