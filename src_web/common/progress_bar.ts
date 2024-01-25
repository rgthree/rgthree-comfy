/**
 * Progress bar web component and prompt execution service.
 */

import type {
  ComfyApiEventDetailCached,
  ComfyApiEventDetailError,
  ComfyApiEventDetailExecuted,
  ComfyApiEventDetailExecuting,
  ComfyApiEventDetailExecutionStart,
  ComfyApiEventDetailProgress,
  ComfyApiEventDetailStatus,
  ComfyApiPrompt,
} from "typings/comfy.js";
// @ts-ignore
import { api } from "../../scripts/api.js";
import type { LGraph as TLGraph, LGraphCanvas as TLGraphCanvas } from "typings/litegraph.js";

/**
 * Wraps general data of a prompt's execution.
 */
class PromptExecution {
  id: string;
  nodesIds: string[] = [];
  executedNodeIds: string[] = [];
  totalNodes: number = 0;
  currentlyExecuting: {
    nodeId: string;
    nodeLabel?: string;
    step?: number;
    maxSteps?: number;
  } | null = null;
  errorDetails: any | null = null;

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Sets the prompt and prompt-related data. This can technically come in lazily, like if the web
   * socket fires the 'execution-start' event before we actually get a response back from the
   * initial prompt call.
   */
  setPrompt(prompt: ComfyApiPrompt) {
    this.nodesIds = Object.keys(prompt.output);
    this.totalNodes = this.nodesIds.length;
  }

  /**
   * Updates the execution data depending on the passed data, fed from api events.
   */
  executing(nodeId: string | null, step?: number, maxSteps?: number) {
    if (nodeId == null) {
      // We're done, any left over nodes must be skipped...
      this.currentlyExecuting = null;
      return;
    }
    if (this.currentlyExecuting?.nodeId !== nodeId) {
      if (this.currentlyExecuting != null) {
        this.executedNodeIds.push(nodeId);
      }
      this.currentlyExecuting = { nodeId };
      const graph = this.maybeGetComfyGraph();
      if (graph) {
        const node = graph.getNodeById(Number(nodeId));
        this.currentlyExecuting.nodeLabel = node?.title || node?.type || undefined;
      }
    }
    if (step != null) {
      this.currentlyExecuting!.step = step;
      this.currentlyExecuting!.maxSteps = maxSteps;
    }
  }

  /**
   * If there's an error, we add the details.
   */
  error(details: any) {
    this.errorDetails = details;
  }

  private maybeGetComfyGraph(): TLGraph | null {
    return ((window as any)?.app?.graph as TLGraph) || null;
  }
}

/**
 * A singleton service that wraps the Comfy API and simplifies the event data being fired.
 */
class ProgressBarService extends EventTarget {
  promptsMap: Map<string, PromptExecution> = new Map();
  currentExecution: PromptExecution | null = null;
  lastQueueRemaining = 0;

  constructor(api: any) {
    super();
    const that = this;

    // Patch the queuePrompt method so we can capture new data going through.
    const queuePrompt = api.queuePrompt;
    api.queuePrompt = async function (num: number, prompt: ComfyApiPrompt) {
      let response;
      try {
        response = await queuePrompt.apply(api, [...arguments]);
      } catch (e) {
        const promptExecution = that.getOrMakePrompt("error");
        promptExecution.error({ exception_type: "Unknown." });
        // console.log("ERROR QUEUE PROMPT", response, arguments);
        throw e;
      }
      // console.log("QUEUE PROMPT", response, arguments);
      const promptExecution = that.getOrMakePrompt(response.prompt_id);
      promptExecution.setPrompt(prompt);
      if (!that.currentExecution) {
        that.currentExecution = promptExecution;
      }
      that.promptsMap.set(response.prompt_id, promptExecution);
      that.dispatchEvent(
        new CustomEvent("queue-prompt", {
          detail: {
            prompt: promptExecution,
          },
        }),
      );
      return response;
    };

    api.addEventListener("status", (e: CustomEvent<ComfyApiEventDetailStatus>) => {
      // Sometimes a status message is fired when the app loades w/o any details.
      if (!e.detail?.exec_info) return;
      if (e.detail.exec_info.queue_remaining > this.lastQueueRemaining) {
        this.lastQueueRemaining = e.detail.exec_info.queue_remaining;
      } else if (e.detail.exec_info.queue_remaining === this.lastQueueRemaining) {
      }
      this.dispatchProgressUpdate();
    });

    api.addEventListener("execution_start", (e: CustomEvent<ComfyApiEventDetailExecutionStart>) => {
      // console.log("execution_start", JSON.stringify(e.detail));
      if (!this.promptsMap.has(e.detail.prompt_id)) {
        console.warn("'execution_start' fired before prompt was made.");
      }
      const prompt = this.getOrMakePrompt(e.detail.prompt_id);
      this.currentExecution = prompt;
      this.dispatchProgressUpdate();
    });

    api.addEventListener("executing", (e: CustomEvent<ComfyApiEventDetailExecuting>) => {
      // console.log("executing", JSON.stringify(e.detail));
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

    api.addEventListener("progress", (e: CustomEvent<ComfyApiEventDetailProgress>) => {
      // console.log("progress", JSON.stringify(e.detail));
      if (!this.currentExecution) {
        this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
        console.warn("'progress' fired before prompt was made.");
      }
      this.currentExecution.executing(e.detail.node, e.detail.value, e.detail.max);
      this.dispatchProgressUpdate();
    });

    api.addEventListener("execution_cached", (e: CustomEvent<ComfyApiEventDetailCached>) => {
      // console.log("execution_cached", JSON.stringify(e.detail));
      if (!this.currentExecution) {
        this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
        console.warn("'execution_cached' fired before prompt was made.");
      }
      for (const cached of e.detail.nodes) {
        this.currentExecution.executing(cached);
      }
      this.dispatchProgressUpdate();
    });

    api.addEventListener("executed", (e: CustomEvent<ComfyApiEventDetailExecuted>) => {
      // console.log("executed", JSON.stringify(e.detail));
      if (!this.currentExecution) {
        this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
        console.warn("'executed' fired before prompt was made.");
      }
    });

    api.addEventListener("execution_error", (e: CustomEvent<ComfyApiEventDetailError>) => {
      // console.log("execution_error", e.detail);
      if (!this.currentExecution) {
        this.currentExecution = this.getOrMakePrompt(e.detail.prompt_id);
        console.warn("'execution_error' fired before prompt was made.");
      }
      this.currentExecution?.error(e.detail);
      this.dispatchProgressUpdate();
    });
  }

  dispatchProgressUpdate() {
    this.dispatchEvent(
      new CustomEvent("progress-update", {
        detail: {
          queue: this.lastQueueRemaining,
          prompt: this.currentExecution,
        },
      }),
    );
  }

  getOrMakePrompt(id: string) {
    let prompt = this.promptsMap.get(id);
    if (!prompt) {
      prompt = new PromptExecution(id);
      this.promptsMap.set(id, prompt);
    }
    return prompt;
  }
}

const SERVICE = new ProgressBarService(api);

/**
 * The progress bar web component.
 */
export class RgthreeProgressBar extends HTMLElement {
  static NAME = "rgthree-progress-bar";

  static create(): RgthreeProgressBar {
    return document.createElement(RgthreeProgressBar.NAME) as RgthreeProgressBar;
  }

  private shadow: ShadowRoot | null = null;
  private progressNodesEl!: HTMLDivElement;
  private progressStepsEl!: HTMLDivElement;
  private progressTextEl!: HTMLSpanElement;

  private currentPromptExecution: PromptExecution | null = null;

  private readonly onProgressUpdateBound = this.onProgressUpdate.bind(this);

  private connected: boolean = false;

  constructor() {
    super();
  }

  private maybeGetComfyGraph(): TLGraph | null {
    return ((window as any)?.app?.graph as TLGraph) || null;
  }
  private maybeGetComfyCanvas(): TLGraphCanvas | null {
    return ((window as any)?.app?.canvas as TLGraphCanvas) || null;
  }

  private onProgressUpdate(e: CustomEvent<{ queue: number; prompt: PromptExecution }>) {
    const prompt = e.detail.prompt;
    this.currentPromptExecution = prompt;

    if (prompt?.errorDetails) {
      let progressText = `${prompt.errorDetails?.exception_type} ${
        prompt.errorDetails?.node_id || ""
      } ${prompt.errorDetails?.node_type || ""}`;
      this.progressTextEl.innerText = progressText;
      this.progressNodesEl.classList.add("-error");
      this.progressStepsEl.classList.add("-error");
      return;
    }
    if (prompt?.currentlyExecuting) {
      this.progressNodesEl.classList.remove("-error");
      this.progressStepsEl.classList.remove("-error");
      const current = prompt?.currentlyExecuting;
      this.progressNodesEl.style.width = `${
        Math.min(2, prompt.executedNodeIds.length / prompt.totalNodes) * 100
      }%`;
      let progressText = `(${e.detail.queue}) `;
      progressText += `Node ${prompt.executedNodeIds.length + 1} of ${prompt.totalNodes || "?"}`;
      let nodeLabel = current.nodeLabel?.trim();
      let stepsLabel = "";
      if (prompt.currentlyExecuting?.step != null && prompt.currentlyExecuting.maxSteps) {
        this.progressStepsEl.style.width = `${
          (prompt.currentlyExecuting.step / prompt.currentlyExecuting.maxSteps) * 100
        }%`;
        stepsLabel += `Step ${prompt.currentlyExecuting.step} of ${prompt.currentlyExecuting.maxSteps}`;
      }
      if (nodeLabel && stepsLabel) {
        progressText += ` [${nodeLabel} : ${stepsLabel}]`;
      } else if (nodeLabel || stepsLabel) {
        progressText += ` [${nodeLabel || stepsLabel}]`;
      }

      if (!stepsLabel) {
        this.progressStepsEl.style.width = `0%`;
      }
      this.progressTextEl.innerText = progressText;
    } else {
      this.progressTextEl.innerText = "Idle";
      this.progressNodesEl.style.width = `0%`;
      this.progressStepsEl.style.width = `0%`;
    }
  }

  connectedCallback() {
    if (this.shadow) {
      return;
    }
    SERVICE.addEventListener("progress-update", this.onProgressUpdateBound as EventListener);

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
        font-weight: bold;
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
    this.shadow.appendChild(this.progressTextEl);

    overlayEl.addEventListener("click", (e: MouseEvent) => {
      this.onClick(e);
    });

    this.connected = true;
  }

  disconnectedCallback() {
    this.connected = false;
    SERVICE.removeEventListener("progress-update", this.onProgressUpdateBound as EventListener);
  }

  onClick(e: PointerEvent | MouseEvent) {
    const prompt = this.currentPromptExecution;
    const nodeId = prompt?.errorDetails?.node_id || prompt?.currentlyExecuting?.nodeId;
    if (!nodeId) return;

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

customElements.define(RgthreeProgressBar.NAME, RgthreeProgressBar);
