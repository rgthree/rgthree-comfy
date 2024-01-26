import { api } from "../../scripts/api.js";
class PromptExecution {
    constructor(id) {
        this.nodesIds = [];
        this.executedNodeIds = [];
        this.totalNodes = 0;
        this.currentlyExecuting = null;
        this.errorDetails = null;
        this.id = id;
    }
    setPrompt(prompt) {
        this.nodesIds = Object.keys(prompt.output);
        this.totalNodes = this.nodesIds.length;
    }
    executing(nodeId, step, maxSteps) {
        var _a;
        if (nodeId == null) {
            this.currentlyExecuting = null;
            return;
        }
        if (((_a = this.currentlyExecuting) === null || _a === void 0 ? void 0 : _a.nodeId) !== nodeId) {
            if (this.currentlyExecuting != null) {
                this.executedNodeIds.push(nodeId);
            }
            this.currentlyExecuting = { nodeId };
            const graph = this.maybeGetComfyGraph();
            if (graph) {
                const node = graph.getNodeById(Number(nodeId));
                this.currentlyExecuting.nodeLabel = (node === null || node === void 0 ? void 0 : node.title) || (node === null || node === void 0 ? void 0 : node.type) || undefined;
            }
        }
        if (step != null) {
            this.currentlyExecuting.step = step;
            this.currentlyExecuting.maxSteps = maxSteps;
        }
    }
    error(details) {
        this.errorDetails = details;
    }
    maybeGetComfyGraph() {
        var _a;
        return ((_a = window === null || window === void 0 ? void 0 : window.app) === null || _a === void 0 ? void 0 : _a.graph) || null;
    }
}
class ProgressBarService extends EventTarget {
    constructor(api) {
        super();
        this.promptsMap = new Map();
        this.currentExecution = null;
        this.lastQueueRemaining = 0;
        const that = this;
        const queuePrompt = api.queuePrompt;
        api.queuePrompt = async function (num, prompt) {
            let response;
            try {
                response = await queuePrompt.apply(api, [...arguments]);
            }
            catch (e) {
                const promptExecution = that.getOrMakePrompt("error");
                promptExecution.error({ exception_type: "Unknown." });
                throw e;
            }
            const promptExecution = that.getOrMakePrompt(response.prompt_id);
            promptExecution.setPrompt(prompt);
            if (!that.currentExecution) {
                that.currentExecution = promptExecution;
            }
            that.promptsMap.set(response.prompt_id, promptExecution);
            that.dispatchEvent(new CustomEvent("queue-prompt", {
                detail: {
                    prompt: promptExecution,
                },
            }));
            return response;
        };
        api.addEventListener("status", (e) => {
            var _a;
            if (!((_a = e.detail) === null || _a === void 0 ? void 0 : _a.exec_info))
                return;
            this.lastQueueRemaining = e.detail.exec_info.queue_remaining;
            this.dispatchProgressUpdate();
        });
        api.addEventListener("execution_start", (e) => {
            if (!this.promptsMap.has(e.detail.prompt_id)) {
                console.warn("'execution_start' fired before prompt was made.");
            }
            const prompt = this.getOrMakePrompt(e.detail.prompt_id);
            this.currentExecution = prompt;
            this.dispatchProgressUpdate();
        });
        api.addEventListener("executing", (e) => {
            if (!this.currentExecution) {
                this.currentExecution = this.getOrMakePrompt("unknown");
                console.warn("'executing' fired before prompt was made.");
            }
            this.currentExecution.executing(e.detail);
            this.dispatchProgressUpdate();
            if (e.detail == null) {
                this.currentExecution = null;
            }
        });
        api.addEventListener("progress", (e) => {
            if (!this.currentExecution) {
                this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
                console.warn("'progress' fired before prompt was made.");
            }
            this.currentExecution.executing(e.detail.node, e.detail.value, e.detail.max);
            this.dispatchProgressUpdate();
        });
        api.addEventListener("execution_cached", (e) => {
            if (!this.currentExecution) {
                this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
                console.warn("'execution_cached' fired before prompt was made.");
            }
            for (const cached of e.detail.nodes) {
                this.currentExecution.executing(cached);
            }
            this.dispatchProgressUpdate();
        });
        api.addEventListener("executed", (e) => {
            if (!this.currentExecution) {
                this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
                console.warn("'executed' fired before prompt was made.");
            }
        });
        api.addEventListener("execution_error", (e) => {
            var _a;
            if (!this.currentExecution) {
                this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
                console.warn("'execution_error' fired before prompt was made.");
            }
            (_a = this.currentExecution) === null || _a === void 0 ? void 0 : _a.error(e.detail);
            this.dispatchProgressUpdate();
        });
    }
    dispatchProgressUpdate() {
        this.dispatchEvent(new CustomEvent("progress-update", {
            detail: {
                queue: this.lastQueueRemaining,
                prompt: this.currentExecution,
            },
        }));
    }
    getOrMakePrompt(id) {
        let prompt = this.promptsMap.get(id);
        if (!prompt) {
            prompt = new PromptExecution(id);
            this.promptsMap.set(id, prompt);
        }
        return prompt;
    }
}
const SERVICE = new ProgressBarService(api);
export class RgthreeProgressBar extends HTMLElement {
    static create() {
        return document.createElement(RgthreeProgressBar.NAME);
    }
    constructor() {
        super();
        this.shadow = null;
        this.currentPromptExecution = null;
        this.onProgressUpdateBound = this.onProgressUpdate.bind(this);
        this.connected = false;
    }
    maybeGetComfyGraph() {
        var _a;
        return ((_a = window === null || window === void 0 ? void 0 : window.app) === null || _a === void 0 ? void 0 : _a.graph) || null;
    }
    maybeGetComfyCanvas() {
        var _a;
        return ((_a = window === null || window === void 0 ? void 0 : window.app) === null || _a === void 0 ? void 0 : _a.canvas) || null;
    }
    onProgressUpdate(e) {
        var _a, _b, _c, _d;
        const prompt = e.detail.prompt;
        this.currentPromptExecution = prompt;
        if (prompt === null || prompt === void 0 ? void 0 : prompt.errorDetails) {
            let progressText = `${(_a = prompt.errorDetails) === null || _a === void 0 ? void 0 : _a.exception_type} ${((_b = prompt.errorDetails) === null || _b === void 0 ? void 0 : _b.node_id) || ""} ${((_c = prompt.errorDetails) === null || _c === void 0 ? void 0 : _c.node_type) || ""}`;
            this.progressTextEl.innerText = progressText;
            this.progressNodesEl.classList.add("-error");
            this.progressStepsEl.classList.add("-error");
            return;
        }
        if (prompt === null || prompt === void 0 ? void 0 : prompt.currentlyExecuting) {
            this.progressNodesEl.classList.remove("-error");
            this.progressStepsEl.classList.remove("-error");
            const current = prompt === null || prompt === void 0 ? void 0 : prompt.currentlyExecuting;
            let progressText = `(${e.detail.queue}) `;
            if (!prompt.totalNodes) {
                progressText += `??%`;
                this.progressNodesEl.style.width = `0%`;
            }
            else {
                const percent = (prompt.executedNodeIds.length / prompt.totalNodes) * 100;
                this.progressNodesEl.style.width = `${Math.max(2, percent)}%`;
                progressText += `${Math.round(percent)}%`;
            }
            let nodeLabel = (_d = current.nodeLabel) === null || _d === void 0 ? void 0 : _d.trim();
            let stepsLabel = "";
            if (current.step != null && current.maxSteps) {
                const percent = (current.step / current.maxSteps) * 100;
                this.progressStepsEl.style.width = `${percent}%`;
                stepsLabel += `${Math.round(percent)}%`;
            }
            if (nodeLabel || stepsLabel) {
                progressText += ` - ${nodeLabel || '???'}${stepsLabel ? ` (${stepsLabel})` : ''}`;
            }
            if (!stepsLabel) {
                this.progressStepsEl.style.width = `0%`;
            }
            this.progressTextEl.innerText = progressText;
        }
        else {
            if (e === null || e === void 0 ? void 0 : e.detail.queue) {
                this.progressTextEl.innerText = `(${e.detail.queue}) Running... in another tab`;
            }
            else {
                this.progressTextEl.innerText = 'Idle';
            }
            this.progressNodesEl.style.width = `0%`;
            this.progressStepsEl.style.width = `0%`;
        }
    }
    connectedCallback() {
        if (this.shadow) {
            return;
        }
        SERVICE.addEventListener("progress-update", this.onProgressUpdateBound);
        this.shadow = this.attachShadow({ mode: "open" });
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`
      :host {
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
      }
      :host * {
        box-sizing: inherit;
      }

      :host > div.bar {
        background: rgba(0, 128, 0);
        position: absolute;
        left: 0;
        top: 0;
        width: 0%;
        height: 50%;
        z-index: 1;
        transition: width 50ms ease-in-out;
      }
      :host > div.bar + div.bar {
        top: 50%;
        height: 50%;
        z-index: 2;
      }
      :host > div.bar.-error {
        background: rgba(128, 0, 0);
      }

      :host > .overlay {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        z-index: 5;
        background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(0,0,0,0.25));
        mix-blend-mode: overlay;
      }

      :host > span {
        position: relative;
        z-index: 4;
        text-align: left;
        font-size: inherit;
        height: 100%;
        font-family: sans-serif;
        text-shadow: 1px 1px 0px #000;
        display: flex;
        flex-direction: row;
        padding: 0 6px;
        align-items: center;
        justify-content: start;
        color: #fff;
        text-shadow: black 0px 0px 2px;
      }

      :host > div.bar[style*="width: 0%"]:first-child,
      :host > div.bar[style*="width:0%"]:first-child {
        height: 0%;
      }
      :host > div.bar[style*="width: 0%"]:first-child + div,
      :host > div.bar[style*="width:0%"]:first-child + div {
        bottom: 0%;
      }
    `);
        this.shadow.adoptedStyleSheets = [sheet];
        const overlayEl = document.createElement("div");
        overlayEl.classList.add("overlay");
        this.shadow.appendChild(overlayEl);
        this.progressNodesEl = document.createElement("div");
        this.progressNodesEl.classList.add("bar");
        this.shadow.appendChild(this.progressNodesEl);
        this.progressStepsEl = document.createElement("div");
        this.progressStepsEl.classList.add("bar");
        this.shadow.appendChild(this.progressStepsEl);
        this.progressTextEl = document.createElement("span");
        this.progressTextEl.innerText = "Idle";
        this.shadow.appendChild(this.progressTextEl);
        overlayEl.addEventListener("click", (e) => {
            this.onClick(e);
        });
        this.connected = true;
    }
    disconnectedCallback() {
        this.connected = false;
        SERVICE.removeEventListener("progress-update", this.onProgressUpdateBound);
    }
    onClick(e) {
        var _a, _b;
        const prompt = this.currentPromptExecution;
        const nodeId = ((_a = prompt === null || prompt === void 0 ? void 0 : prompt.errorDetails) === null || _a === void 0 ? void 0 : _a.node_id) || ((_b = prompt === null || prompt === void 0 ? void 0 : prompt.currentlyExecuting) === null || _b === void 0 ? void 0 : _b.nodeId);
        if (!nodeId)
            return;
        const graph = this.maybeGetComfyGraph();
        const canvas = this.maybeGetComfyCanvas();
        if (graph && canvas) {
            const node = graph.getNodeById(Number(nodeId));
            if (node) {
                canvas.centerOnNode(node);
                e.stopPropagation();
                e.preventDefault();
            }
        }
    }
    updateProgress() {
        if (!this.shadow) {
            return;
        }
    }
}
RgthreeProgressBar.NAME = "rgthree-progress-bar";
customElements.define(RgthreeProgressBar.NAME, RgthreeProgressBar);
