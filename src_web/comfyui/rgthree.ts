import {
  type LGraphCanvas as TLGraphCanvas,
  type LGraphNode,
  type SerializedLGraphNode,
  type serializedLGraph,
} from "typings/litegraph.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { api } from "../../scripts/api.js";
// @ts-ignore
import { rgthreeConfig } from "./rgthree_config.js";
import { fixBadLinks } from "rgthree/common/link_fixer.js";
import { wait } from "rgthree/common/shared_utils.js";
import { replaceNode, waitForCanvas, waitForGraph } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { RgthreeProgressBar } from "rgthree/common/progress_bar.js";

declare const LGraphCanvas: typeof TLGraphCanvas;

export enum LogLevel {
  IMPORTANT = 1,
  ERROR,
  WARN,
  INFO,
  DEBUG,
}

type ConsoleLogFns = "log" | "error" | "warn" | "debug" | "info";
const LogLevelToMethod: { [key in LogLevel]: ConsoleLogFns } = {
  [LogLevel.IMPORTANT]: "log",
  [LogLevel.ERROR]: "error",
  [LogLevel.WARN]: "warn",
  [LogLevel.INFO]: "info",
  [LogLevel.DEBUG]: "debug",
};
const LogLevelToCSS: { [key in LogLevel]: string } = {
  [LogLevel.IMPORTANT]: "font-weight:bold; color:blue;",
  [LogLevel.ERROR]: "",
  [LogLevel.WARN]: "",
  [LogLevel.INFO]: "",
  [LogLevel.DEBUG]: "font-style: italic;",
};

let GLOBAL_LOG_LEVEL = LogLevel.DEBUG;

/** A basic wrapper around logger. */
class Logger {
  log(level: LogLevel, message: string, ...args: any[]) {
    if (level <= GLOBAL_LOG_LEVEL) {
      const css = LogLevelToCSS[level] || "";
      console[LogLevelToMethod[level]](`%c${message}`, css, ...args);
    }
  }
}

/**
 * A log session, with the name as the prefix. A new session will stack prefixes.
 */
class LogSession {
  logger = new Logger();
  constructor(readonly name?: string) {}

  log(levelOrMessage: LogLevel | string, message?: string, ...args: any[]) {
    let level = typeof levelOrMessage === "string" ? LogLevel.INFO : levelOrMessage;
    if (typeof levelOrMessage === "string") {
      message = levelOrMessage;
    }
    this.logger.log(level, `${this.name || ""}${message ? " " + message : ""}`, ...args);
  }

  debug(message?: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message?: string, ...args: any[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  error(message?: string, ...args: any[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }

  newSession(name?: string) {
    return new LogSession(`${this.name}${name}`);
  }
}

export type RgthreeUiMessage = {
  id: string;
  message: string;
  type?: "warn" | null;
  timeout?: number;
  // closeable?: boolean; // TODO
  actions?: Array<{
    label: string;
    href?: string;
    callback?: (event: MouseEvent) => void;
  }>;
};

/**
 * A global class as 'rgthree'; exposed on wiindow. Lots can go in here.
 */
class Rgthree extends EventTarget {
  /** The users' config. */
  readonly config = rgthreeConfig;

  /** Exposes the ComfyUI api instance on rgthree. */
  readonly api = api;

  /** Are any functional keys pressed in this given moment? */
  ctrlKey = false;
  altKey = false;
  metaKey = false;
  shiftKey = false;
  readonly downKeys: { [key: string]: boolean } = {};

  logger = new LogSession("[rgthree]");

  monitorBadLinksAlerted = false;
  monitorLinkTimeout: number | null = null;

  processingQueue = false;
  loadingApiJson = false;

  // Comfy/LiteGraph states so nodes and tell what the hell is going on.
  canvasCurrentlyCopyingToClipboard = false;
  canvasCurrentlyCopyingToClipboardWithMultipleNodes = false;
  initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff: any = null;

  constructor() {
    super();
    window.addEventListener("keydown", (e) => {
      this.handleKeydown(e);
    });

    window.addEventListener("keyup", (e) => {
      this.handleKeyup(e);
    });

    this.initializeGraphAndCanvasHooks();
    this.initializeComfyUIHooks();
    this.initializeContextMenu();

    wait(100).then(() => {
      this.injectRgthreeCss();
    });

    this.initializeProgressBar();
  }

  /**
   * Initializes the top progress bar, if it's configured.
   */
  initializeProgressBar() {
    if (this.config?.features?.progress_bar?.enabled) {
      document.body.appendChild(RgthreeProgressBar.create());
    }
  }

  /**
   * Initialize a bunch of hooks into LiteGraph itself so we can either keep state or context on
   * what's happening so nodes can respond appropriately. This is usually to fix broken assumptions
   * in the unowned code [🤮], but sometimes to add features or enhancements too [⭐].
   */
  private async initializeGraphAndCanvasHooks() {
    const rgthree = this;
    const [canvas, graph] = await Promise.all([waitForCanvas(), waitForGraph()]);

    // [🤮] To mitigate changes from https://github.com/rgthree/rgthree-comfy/issues/69
    // and https://github.com/comfyanonymous/ComfyUI/issues/2193 we can try to store the workflow
    // node so our nodes can find the seralized node. Works with method
    // `getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff` to find a node
    // while serializing. What a way to work around...
    const onSerialize = (graph as any).onSerialize;
    (graph as any).onSerialize = (data: any) => {
      this.initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff = data;
      onSerialize?.call(graph, data);
    };

    // [🤮] Copying to clipboard clones nodes and then manipulats the linking data manually which
    // does not allow a node to handle connections. This harms nodes that manually handle inputs,
    // like our any-input nodes that may start with one input, and manually add new ones when one is
    // attached.
    const copyToClipboard = LGraphCanvas.prototype.copyToClipboard;
    LGraphCanvas.prototype.copyToClipboard = function (nodes: LGraphNode[]) {
      rgthree.canvasCurrentlyCopyingToClipboard = true;
      rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes =
        Object.values(nodes || this.selected_nodes || []).length > 1;
      copyToClipboard.apply(canvas, [...arguments] as any);
      rgthree.canvasCurrentlyCopyingToClipboard = false;
      rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes = false;
    };

    // [⭐] Make it so when we add a group, we get to name it immediately.
    const onGroupAdd = LGraphCanvas.onGroupAdd;
    LGraphCanvas.onGroupAdd = function (...args: any[]) {
      onGroupAdd.apply(canvas, [...args] as any);
      LGraphCanvas.onShowPropertyEditor(
        {},
        null,
        null,
        null,
        graph._groups[graph._groups.length - 1],
      );
    };
  }

  /**
   * Initializes hooks specific to an rgthree-comfy context menu on the root menu.
   */
  private async initializeContextMenu() {
    const graph = await waitForGraph();
    setTimeout(() => {
      const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const options = getCanvasMenuOptions.apply(this, [...args] as any);

        const hasReroutes = graph._nodes.find((n) => n.type == "Reroute");

        options.push(null); // Divider
        options.push({
          content: `
          <svg viewBox="0 0 256 256">
            <path d="M88.503,158.997 L152.731,196.103 L152.738,196.092 L152.762,196.103 L152.769,196.106 L152.771,196.103 L183.922,142.084     L174.153,136.437 L148.611,180.676 L101.512,153.484 L132.193,30.415 L156.124,71.869 L165.896,66.225 L128.002,0.59 "></path>
            <path d="M55.586,148.581l13.44,47.521l0.014,0.051l0.168-0.051l10.689-3.022l-6.589-23.313l45.609,26.335l0.087,0.051l0.027-0.051     l5.617-9.718l-42.648-24.622l35.771-143.45L33.232,164.729l9.77,5.645L55.586,148.581z M87.394,93.484l-16.708,67.018l-5.018-17.747     l-8.028,2.27L87.394,93.484z"></path>
            <path d="M189.85,107.717 L137.892,137.718 L143.532,147.49 L185.723,123.133 L231.109,201.746 L24.895,201.746 L37.363,180.146     L27.592,174.505 L5.347,213.03 L250.653,213.03 "></path>
            <path d="M5.347,247.299v8.111h245.307v-8.111l-41.94-0.003c-1.336,0-2.404-1.065-2.441-2.396v-12.14     c0.037-1.315,1.089-2.368,2.41-2.385h41.972v-8.11H5.347v8.11h41.951c1.338,0.017,2.427,1.104,2.427,2.449v12.01     c0,1.365-1.105,2.462-2.457,2.462L5.347,247.299z M139.438,247.296c-1.334,0-2.406-1.065-2.439-2.396v-12.14     c0.033-1.315,1.085-2.368,2.41-2.385h46.415c1.335,0.017,2.425,1.104,2.425,2.449v12.01c0,1.365-1.103,2.462-2.459,2.462H139.438z       M70.193,247.296c-1.339,0-2.408-1.065-2.441-2.396v-12.14c0.033-1.315,1.086-2.368,2.407-2.385h46.418     c1.336,0.017,2.425,1.104,2.425,2.449v12.01c0,1.365-1.103,2.462-2.458,2.462H70.193z"></path>
          </svg>
          rgthree-comfy`,
          className: "rgthree-contextmenu-item rgthree-contextmenu-main-rgthree-comfy",
          submenu: {
            options: [
              {
                content: "Functions",
                disabled: true,
                className: "rgthree-contextmenu-item rgthree-contextmenu-label",
              },
              {
                content: "Convert all 'Reroute' => 'Reroute (rgthree)'",
                disabled: !hasReroutes,
                callback: (...args: any[]) => {
                  const msg =
                    "Convert all comfyui reroute nodes to rgthree-comfy reroute nodes? \n" +
                    "(First save a copy of your workflow & check reroute connections afterwards)";
                  if (!window.confirm(msg)) {
                    return;
                  }
                  (async () => {
                    const nodes = [...graph._nodes];
                    for (const node of nodes) {
                      if (node.type == "Reroute") {
                        await replaceNode(node, NodeTypesString.REROUTE);
                      }
                    }
                  })();
                },
              },
              {
                content: "More...",
                disabled: true,
                className: "rgthree-contextmenu-item rgthree-contextmenu-label",
              },
              {
                content: `
                <svg viewBox="0 0 16 16" class="github-star">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
                </svg>
                Star on Github`,
                callback: (...args: any[]) => {
                  window.open("https://github.com/rgthree/rgthree-comfy", "_blank");
                },
                className: "rgthree-contextmenu-item rgthree-contextmenu-github",
              },
            ],
          },
        });

        return options;
      };
    }, 1000);
  }

  /**
   * Initialize a bunch of hooks into ComfyUI and/or LiteGraph itself so we can either keep state or
   * context on what's happening so nodes can respond appropriately. This is usually to fix broken
   * assumptions in the unowned code [🤮], but sometimes to add features or enhancements too [⭐].
   */
  private initializeComfyUIHooks() {
    const rgthree = this;

    // Keep state for when the app is queuing the prompt. For instance, this is used for seed to
    // understand if we're serializing because we're queueing (and return the random seed to use) or
    // for saving the workflow (and keep -1, etc.).
    const queuePrompt = app.queuePrompt as Function;
    app.queuePrompt = async function () {
      rgthree.dispatchEvent(new CustomEvent("queue"));
      rgthree.processingQueue = true;
      try {
        await queuePrompt.apply(app, [...arguments]);
      } finally {
        rgthree.processingQueue = false;
        rgthree.dispatchEvent(new CustomEvent("queue-end"));
      }
    };

    // Keep state for when the app is in the middle of loading from an api JSON file.
    const loadApiJson = app.loadApiJson as Function;
    app.loadApiJson = async function () {
      rgthree.loadingApiJson = true;
      try {
        loadApiJson.apply(app, [...arguments]);
      } finally {
        rgthree.loadingApiJson = false;
      }
    };

    // Keep state for when the app is serizalizing the graph to prompt.
    const graphToPrompt = app.graphToPrompt as Function;
    app.graphToPrompt = async function () {
      rgthree.dispatchEvent(new CustomEvent("graph-to-prompt"));
      let promise = graphToPrompt.apply(app, [...arguments]);
      await promise;
      rgthree.dispatchEvent(new CustomEvent("graph-to-prompt-end"));
      return promise;
    };

    // Hook into a clean call; allow us to clear and rgthree messages.
    const clean = app.clean;
    app.clean = function () {
      rgthree.clearAllMessages();
      clean && clean.call(app, ...arguments);
    };

    // Hook into a data load, like from an image or JSON drop-in. This is (currently) used to
    // monitor for bad linking data.
    const loadGraphData = app.loadGraphData;
    app.loadGraphData = function (graph: serializedLGraph) {
      if (rgthree.monitorLinkTimeout) {
        clearTimeout(rgthree.monitorLinkTimeout);
        rgthree.monitorLinkTimeout = null;
      }
      rgthree.clearAllMessages();
      // Try to make a copy to use, because ComfyUI's loadGraphData will modify it.
      let graphCopy: serializedLGraph | null;
      try {
        graphCopy = JSON.parse(JSON.stringify(graph));
      } catch (e) {
        graphCopy = null;
      }
      setTimeout(() => {
        const wasLoadingAborted = document
          .querySelector(".comfy-modal-content")
          ?.textContent?.includes("Loading aborted due");
        const graphToUse = wasLoadingAborted ? graphCopy || graph : app.graph;
        const fixBadLinksResult = fixBadLinks(graphToUse);
        if (fixBadLinksResult.hasBadLinks) {
          rgthree.log(
            LogLevel.WARN,
            `The workflow you've loaded has corrupt linking data. Open ${
              new URL(location.href).origin
            }/rgthree/link_fixer to try to fix.`,
          );
          if (rgthreeConfig["show_alerts_for_corrupt_workflows"]) {
            rgthree.showMessage({
              id: "bad-links",
              type: "warn",
              message:
                "The workflow you've loaded has corrupt linking data that may be able to be fixed.",
              actions: [
                {
                  label: "Open fixer",
                  href: "/rgthree/link_fixer",
                },
                {
                  label: "Fix in place",
                  href: "/rgthree/link_fixer",
                  callback: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    if (
                      confirm(
                        "This will attempt to fix in place. Please make sure to have a saved copy of your workflow.",
                      )
                    ) {
                      try {
                        const fixBadLinksResult = fixBadLinks(graphToUse, true);
                        if (!fixBadLinksResult.hasBadLinks) {
                          rgthree.hideMessage("bad-links");
                          alert(
                            "Success! It's possible some valid links may have been affected. Please check and verify your workflow.",
                          );
                          wasLoadingAborted && app.loadGraphData(fixBadLinksResult.graph);
                          if (
                            rgthreeConfig["monitor_for_corrupt_links"] ||
                            rgthreeConfig["monitor_bad_links"]
                          ) {
                            rgthree.monitorLinkTimeout = setTimeout(() => {
                              rgthree.monitorBadLinks();
                            }, 5000);
                          }
                        }
                      } catch (e) {
                        console.error(e);
                        alert("Unsuccessful at fixing corrupt data. :(");
                        rgthree.hideMessage("bad-links");
                      }
                    }
                  },
                },
              ],
            });
          }
        } else if (
          rgthreeConfig["monitor_for_corrupt_links"] ||
          rgthreeConfig["monitor_bad_links"]
        ) {
          rgthree.monitorLinkTimeout = setTimeout(() => {
            rgthree.monitorBadLinks();
          }, 5000);
        }
      }, 100);
      loadGraphData && loadGraphData.call(app, ...arguments);
    };
  }

  /**
   * [🤮] Finds a node in the currently serializing workflow from the hook setup above. This is to
   * mitigate breakages from https://github.com/comfyanonymous/ComfyUI/issues/2193 we can try to
   * store the workflow node so our nodes can find the seralized node.
   */
  getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(
    node: LGraphNode,
  ): SerializedLGraphNode | null {
    return (
      this.initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff?.nodes?.find(
        (n: SerializedLGraphNode) => n.id === node.id,
      ) ?? null
    );
  }

  /**
   * Shows a message in the UI.
   */
  async showMessage(data: RgthreeUiMessage) {
    let container = document.querySelector(".rgthree-top-messages-container");
    if (!container) {
      container = document.createElement("div");
      container.classList.add("rgthree-top-messages-container");
      document.body.appendChild(container);
    }
    // Hide if we exist.
    await this.hideMessage(data.id);

    const messageContainer = document.createElement("div");
    messageContainer.setAttribute("type", data.type || "info");

    const message = document.createElement("span");
    message.innerText = data.message;
    messageContainer.appendChild(message);

    for (let a = 0; a < (data.actions || []).length; a++) {
      const action = data.actions![a]!;
      if (a > 0) {
        const sep = document.createElement("span");
        sep.innerHTML = "&nbsp;|&nbsp;";
        messageContainer.appendChild(sep);
      }

      const actionEl = document.createElement("a");
      actionEl.innerText = action.label;
      if (action.href) {
        actionEl.target = "_blank";
        actionEl.href = action.href;
      }
      if (action.callback) {
        actionEl.onclick = (e) => {
          return action.callback!(e);
        };
      }
      messageContainer.appendChild(actionEl);
    }

    const messageAnimContainer = document.createElement("div");
    messageAnimContainer.setAttribute("msg-id", data.id);
    messageAnimContainer.appendChild(messageContainer);
    container.appendChild(messageAnimContainer);

    // Add. Wait. Measure. Wait. Anim.
    await wait(64);
    messageAnimContainer.style.marginTop = `-${messageAnimContainer.offsetHeight}px`;
    await wait(64);
    messageAnimContainer.classList.add("-show");

    if (data.timeout) {
      await wait(data.timeout);
      this.hideMessage(data.id);
    }
  }

  /**
   * Hides a message in the UI.
   */
  async hideMessage(id: string) {
    const msg = document.querySelector(`.rgthree-top-messages-container > [msg-id="${id}"]`);
    if (msg?.classList.contains("-show")) {
      msg.classList.remove("-show");
      await wait(750);
    }
    msg && msg.remove();
  }

  /**
   * Clears all messages in the UI.
   */
  async clearAllMessages() {
    let container = document.querySelector(".rgthree-top-messages-container");
    container && (container.innerHTML = "");
  }

  /**
   * Handle keydown. Pulled out because sometimes a node will get a keydown before rgthree.
   */
  handleKeydown(e: KeyboardEvent) {
    this.ctrlKey = !!e.ctrlKey;
    this.altKey = !!e.altKey;
    this.metaKey = !!e.metaKey;
    this.shiftKey = !!e.shiftKey;
    this.downKeys[e.key.toLocaleUpperCase()] = true;
    this.downKeys["^" + e.key.toLocaleUpperCase()] = true;
  }

  /**
   * Handle keyup. Pulled out because sometimes a node will get a keyup before rgthree.
   */
  handleKeyup(e: KeyboardEvent) {
    this.ctrlKey = !!e.ctrlKey;
    this.altKey = !!e.altKey;
    this.metaKey = !!e.metaKey;
    this.shiftKey = !!e.shiftKey;
    this.downKeys[e.key.toLocaleUpperCase()] = false;
    this.downKeys["^" + e.key.toLocaleUpperCase()] = false;
  }

  /**
   * Checks if all keys passed in are down.
   */
  areAllKeysDown(keys: string[], caseSensitive = false) {
    return keys.every((k) => {
      if (caseSensitive) {
        return rgthree.downKeys["^" + k.trim()];
      }
      return rgthree.downKeys[k.trim().toUpperCase()];
    });
  }

  /**
   * Injects the rgthree.css file into the app.
   */
  private injectRgthreeCss() {
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "extensions/rgthree-comfy/rgthree.css";
    document.head.appendChild(link);
  }

  setLogLevel(level: LogLevel) {
    GLOBAL_LOG_LEVEL = level;
  }

  log(levelOrMessage: LogLevel | string, message?: string, ...args: any[]) {
    this.logger.log(levelOrMessage, message, ...args);
  }

  newLogSession(name?: string) {
    return this.logger.newSession(name);
  }

  monitorBadLinks() {
    const badLinksFound = fixBadLinks(app.graph);
    if (badLinksFound.hasBadLinks && !this.monitorBadLinksAlerted) {
      this.monitorBadLinksAlerted = true;
      alert(
        `Problematic links just found in live data. Can you save your workflow and file a bug with ` +
          `the last few steps you took to trigger this at ` +
          `https://github.com/rgthree/rgthree-comfy/issues. Thank you!`,
      );
    } else if (!badLinksFound.hasBadLinks) {
      // Clear the alert once fixed so we can alert again.
      this.monitorBadLinksAlerted = false;
    }
    this.monitorLinkTimeout = setTimeout(() => {
      this.monitorBadLinks();
    }, 5000);
  }
}

export const rgthree = new Rgthree();
// @ts-ignore. Expose it on window because, why not.
window.rgthree = rgthree;
