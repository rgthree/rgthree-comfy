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
import { SERVICE as CONFIG_SERVICE } from "./config.js";
import { fixBadLinks } from "rgthree/common/link_fixer.js";
import { wait } from "rgthree/common/shared_utils.js";
import { replaceNode, waitForCanvas, waitForGraph } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { RgthreeProgressBar } from "rgthree/common/progress_bar.js";
import { RgthreeConfigDialog } from "./config.js";
import { querySelectorAll as $$ } from "rgthree/common/utils_dom.js";
import { iconGear, iconReplace, iconStarFilled, logoRgthree } from "rgthree/common/media/svgs.js";

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
  /** Logs a message to the console if it meets the current log level. */
  log(level: LogLevel, message: string, ...args: any[]) {
    const [n, v] = this.logParts(level, message, ...args);
    console[n]?.(...v);
  }

  /**
   * Returns a tuple of the console function and its arguments. Useful for callers to make the
   * actual console.<fn> call to gain benefits of DevTools knowing the source line.
   *
   * If the input is invalid or the level doesn't meet the configuration level, then the return
   * value is an unknown function and empty set of values. Callers can use optionla chaining
   * successfully:
   *
   *     const [fn, values] = logger.logPars(LogLevel.INFO, 'my message');
   *     console[fn]?.(...values); // Will work even if INFO won't be logged.
   *
   */
  logParts(level: LogLevel, message: string, ...args: any[]): [ConsoleLogFns, any[]] {
    if (level <= GLOBAL_LOG_LEVEL) {
      const css = LogLevelToCSS[level] || "";
      return [LogLevelToMethod[level], [`%c${message}`, css, ...args]];
    }
    return ["none" as "info", []];
  }
}

/**
 * A log session, with the name as the prefix. A new session will stack prefixes.
 */
class LogSession {
  logger = new Logger();
  constructor(readonly name?: string) {}

  log(levelOrMessage: LogLevel | string, message?: string, ...args: any[]) {
    const [n, v] = this.logParts(levelOrMessage, message, ...args);
    console[n]?.(...v);
  }

  logParts(levelOrMessage: LogLevel | string, message?: string, ...args: any[]) {
    let level = typeof levelOrMessage === "string" ? LogLevel.INFO : levelOrMessage;
    message = typeof levelOrMessage === "string" ? levelOrMessage : message;
    return this.logger.logParts(
      level,
      `${this.name || ""}${message ? " " + message : ""}`,
      ...args,
    );
  }

  debug(message?: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  debugParts(message?: string, ...args: any[]) {
    return this.logParts(LogLevel.DEBUG, message, ...args);
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
  /** Exposes the ComfyUI api instance on rgthree. */
  readonly api = api;
  private settingsDialog: RgthreeConfigDialog | null = null;

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
  replacingReroute: number|null = null;

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

    CONFIG_SERVICE.addEventListener("config-change", ((e: CustomEvent) => {
      if (e.detail?.key?.includes("features.progress_bar")) {
        this.initializeProgressBar();
      }
    }) as EventListener);
  }

  /**
   * Initializes the top progress bar, if it's configured.
   */
  initializeProgressBar() {
    if (CONFIG_SERVICE.getConfigValue("features.progress_bar.enabled")) {
      document.body.appendChild(RgthreeProgressBar.create());
    } else {
      $$(RgthreeProgressBar.NAME)[0]?.remove();
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
    const that = this;
    setTimeout(() => {
      const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
      LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
        const options = getCanvasMenuOptions.apply(this, [...args] as any);

        const selectedNodes = Object.values(this.selected_nodes || {});
        let rerouteNodes: LGraphNode[] = [];
        if (selectedNodes.length) {
          rerouteNodes = selectedNodes.filter((n) => n.type === "Reroute");
        } else {
          rerouteNodes = graph._nodes.filter((n) => n.type == "Reroute");
        }
        const rerouteLabel = selectedNodes.length ? "selected" : "all";

        options.push(null); // Divider
        options.push({
          content: logoRgthree + `rgthree-comfy`,
          className: "rgthree-contextmenu-item rgthree-contextmenu-main-rgthree-comfy",
          submenu: {
            options: [
              {
                content: "Actions",
                disabled: true,
                className: "rgthree-contextmenu-item rgthree-contextmenu-label",
              },
              {
                content: iconGear + "Open rgthree-comfy Settings",
                disabled: !!that.settingsDialog,
                className: "rgthree-contextmenu-item",
                callback: (...args: any[]) => {
                  that.settingsDialog = new RgthreeConfigDialog().show();
                  that.settingsDialog.addEventListener("close", (e) => {
                    that.settingsDialog = null;
                  });
                },
              },
              {
                content: iconReplace + ` Convert ${rerouteLabel} Reroutes`,
                disabled: !rerouteNodes.length,
                className: "rgthree-contextmenu-item",
                callback: (...args: any[]) => {
                  const msg =
                    `Convert ${rerouteLabel} ComfyUI Reroutes to Reroute (rgthree) nodes? \n` +
                    `(First save a copy of your workflow & check reroute connections afterwards)`;
                  if (!window.confirm(msg)) {
                    return;
                  }
                  (async () => {
                    for (const node of [...rerouteNodes]) {
                      if (node.type == "Reroute") {
                        that.replacingReroute = node.id;
                        await replaceNode(node, NodeTypesString.REROUTE);
                        that.replacingReroute = null;
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
                content: iconStarFilled + "Star on Github",
                className: "rgthree-contextmenu-item rgthree-contextmenu-github",
                callback: (...args: any[]) => {
                  window.open("https://github.com/rgthree/rgthree-comfy", "_blank");
                },
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
          if (CONFIG_SERVICE.getConfigValue("features.show_alerts_for_corrupt_workflows")) {
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
                            CONFIG_SERVICE.getConfigValue("features.monitor_for_corrupt_links") ||
                            CONFIG_SERVICE.getConfigValue("features.monitor_bad_links")
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
          CONFIG_SERVICE.getConfigValue("features.monitor_for_corrupt_links") ||
          CONFIG_SERVICE.getConfigValue("features.monitor_bad_links")
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
