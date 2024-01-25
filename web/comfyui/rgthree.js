import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { rgthreeConfig } from "./rgthree_config.js";
import { fixBadLinks } from "../../rgthree/common/link_fixer.js";
import { wait } from "../../rgthree/common/shared_utils.js";
import { replaceNode, waitForCanvas, waitForGraph } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { RgthreeProgressBar } from "../../rgthree/common/progress_bar.js";
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["IMPORTANT"] = 1] = "IMPORTANT";
    LogLevel[LogLevel["ERROR"] = 2] = "ERROR";
    LogLevel[LogLevel["WARN"] = 3] = "WARN";
    LogLevel[LogLevel["INFO"] = 4] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 5] = "DEBUG";
})(LogLevel || (LogLevel = {}));
const LogLevelToMethod = {
    [LogLevel.IMPORTANT]: "log",
    [LogLevel.ERROR]: "error",
    [LogLevel.WARN]: "warn",
    [LogLevel.INFO]: "info",
    [LogLevel.DEBUG]: "debug",
};
const LogLevelToCSS = {
    [LogLevel.IMPORTANT]: "font-weight:bold; color:blue;",
    [LogLevel.ERROR]: "",
    [LogLevel.WARN]: "",
    [LogLevel.INFO]: "",
    [LogLevel.DEBUG]: "font-style: italic;",
};
let GLOBAL_LOG_LEVEL = LogLevel.DEBUG;
class Logger {
    log(level, message, ...args) {
        if (level <= GLOBAL_LOG_LEVEL) {
            const css = LogLevelToCSS[level] || "";
            console[LogLevelToMethod[level]](`%c${message}`, css, ...args);
        }
    }
}
class LogSession {
    constructor(name) {
        this.name = name;
        this.logger = new Logger();
    }
    log(levelOrMessage, message, ...args) {
        let level = typeof levelOrMessage === "string" ? LogLevel.INFO : levelOrMessage;
        if (typeof levelOrMessage === "string") {
            message = levelOrMessage;
        }
        this.logger.log(level, `${this.name || ""}${message ? " " + message : ""}`, ...args);
    }
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }
    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }
    error(message, ...args) {
        this.log(LogLevel.ERROR, message, ...args);
    }
    newSession(name) {
        return new LogSession(`${this.name}${name}`);
    }
}
class Rgthree extends EventTarget {
    constructor() {
        super();
        this.config = rgthreeConfig;
        this.api = api;
        this.ctrlKey = false;
        this.altKey = false;
        this.metaKey = false;
        this.shiftKey = false;
        this.downKeys = {};
        this.logger = new LogSession("[rgthree]");
        this.monitorBadLinksAlerted = false;
        this.monitorLinkTimeout = null;
        this.processingQueue = false;
        this.loadingApiJson = false;
        this.replacingReroute = null;
        this.canvasCurrentlyCopyingToClipboard = false;
        this.canvasCurrentlyCopyingToClipboardWithMultipleNodes = false;
        this.initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff = null;
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
    initializeProgressBar() {
        var _a, _b, _c;
        if ((_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.features) === null || _b === void 0 ? void 0 : _b.progress_bar) === null || _c === void 0 ? void 0 : _c.enabled) {
            document.body.appendChild(RgthreeProgressBar.create());
        }
    }
    async initializeGraphAndCanvasHooks() {
        const rgthree = this;
        const [canvas, graph] = await Promise.all([waitForCanvas(), waitForGraph()]);
        const onSerialize = graph.onSerialize;
        graph.onSerialize = (data) => {
            this.initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff = data;
            onSerialize === null || onSerialize === void 0 ? void 0 : onSerialize.call(graph, data);
        };
        const copyToClipboard = LGraphCanvas.prototype.copyToClipboard;
        LGraphCanvas.prototype.copyToClipboard = function (nodes) {
            rgthree.canvasCurrentlyCopyingToClipboard = true;
            rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes =
                Object.values(nodes || this.selected_nodes || []).length > 1;
            copyToClipboard.apply(canvas, [...arguments]);
            rgthree.canvasCurrentlyCopyingToClipboard = false;
            rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes = false;
        };
        const onGroupAdd = LGraphCanvas.onGroupAdd;
        LGraphCanvas.onGroupAdd = function (...args) {
            onGroupAdd.apply(canvas, [...args]);
            LGraphCanvas.onShowPropertyEditor({}, null, null, null, graph._groups[graph._groups.length - 1]);
        };
    }
    async initializeContextMenu() {
        const graph = await waitForGraph();
        const that = this;
        setTimeout(() => {
            const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
            LGraphCanvas.prototype.getCanvasMenuOptions = function (...args) {
                const options = getCanvasMenuOptions.apply(this, [...args]);
                const selectedNodes = Object.values(this.selected_nodes || {});
                let rerouteNodes = [];
                if (selectedNodes.length) {
                    rerouteNodes = selectedNodes.filter((n) => n.type === "Reroute");
                }
                else {
                    rerouteNodes = graph._nodes.filter((n) => n.type == "Reroute");
                }
                const rerouteLabel = selectedNodes.length ? "selected" : "all";
                options.push(null);
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
                                content: `Convert ${rerouteLabel} Reroutes`,
                                disabled: !rerouteNodes.length,
                                callback: (...args) => {
                                    const msg = `Convert ${rerouteLabel} ComfyUI Reroutes to Reroute (rgthree) nodes? \n` +
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
                                content: `
                <svg viewBox="0 0 16 16" class="github-star">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
                </svg>
                Star on Github`,
                                callback: (...args) => {
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
    initializeComfyUIHooks() {
        const rgthree = this;
        const queuePrompt = app.queuePrompt;
        app.queuePrompt = async function () {
            rgthree.dispatchEvent(new CustomEvent("queue"));
            rgthree.processingQueue = true;
            try {
                await queuePrompt.apply(app, [...arguments]);
            }
            finally {
                rgthree.processingQueue = false;
                rgthree.dispatchEvent(new CustomEvent("queue-end"));
            }
        };
        const loadApiJson = app.loadApiJson;
        app.loadApiJson = async function () {
            rgthree.loadingApiJson = true;
            try {
                loadApiJson.apply(app, [...arguments]);
            }
            finally {
                rgthree.loadingApiJson = false;
            }
        };
        const graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            rgthree.dispatchEvent(new CustomEvent("graph-to-prompt"));
            let promise = graphToPrompt.apply(app, [...arguments]);
            await promise;
            rgthree.dispatchEvent(new CustomEvent("graph-to-prompt-end"));
            return promise;
        };
        const clean = app.clean;
        app.clean = function () {
            rgthree.clearAllMessages();
            clean && clean.call(app, ...arguments);
        };
        const loadGraphData = app.loadGraphData;
        app.loadGraphData = function (graph) {
            if (rgthree.monitorLinkTimeout) {
                clearTimeout(rgthree.monitorLinkTimeout);
                rgthree.monitorLinkTimeout = null;
            }
            rgthree.clearAllMessages();
            let graphCopy;
            try {
                graphCopy = JSON.parse(JSON.stringify(graph));
            }
            catch (e) {
                graphCopy = null;
            }
            setTimeout(() => {
                var _a, _b;
                const wasLoadingAborted = (_b = (_a = document
                    .querySelector(".comfy-modal-content")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes("Loading aborted due");
                const graphToUse = wasLoadingAborted ? graphCopy || graph : app.graph;
                const fixBadLinksResult = fixBadLinks(graphToUse);
                if (fixBadLinksResult.hasBadLinks) {
                    rgthree.log(LogLevel.WARN, `The workflow you've loaded has corrupt linking data. Open ${new URL(location.href).origin}/rgthree/link_fixer to try to fix.`);
                    if (rgthreeConfig["show_alerts_for_corrupt_workflows"]) {
                        rgthree.showMessage({
                            id: "bad-links",
                            type: "warn",
                            message: "The workflow you've loaded has corrupt linking data that may be able to be fixed.",
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
                                        if (confirm("This will attempt to fix in place. Please make sure to have a saved copy of your workflow.")) {
                                            try {
                                                const fixBadLinksResult = fixBadLinks(graphToUse, true);
                                                if (!fixBadLinksResult.hasBadLinks) {
                                                    rgthree.hideMessage("bad-links");
                                                    alert("Success! It's possible some valid links may have been affected. Please check and verify your workflow.");
                                                    wasLoadingAborted && app.loadGraphData(fixBadLinksResult.graph);
                                                    if (rgthreeConfig["monitor_for_corrupt_links"] ||
                                                        rgthreeConfig["monitor_bad_links"]) {
                                                        rgthree.monitorLinkTimeout = setTimeout(() => {
                                                            rgthree.monitorBadLinks();
                                                        }, 5000);
                                                    }
                                                }
                                            }
                                            catch (e) {
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
                }
                else if (rgthreeConfig["monitor_for_corrupt_links"] ||
                    rgthreeConfig["monitor_bad_links"]) {
                    rgthree.monitorLinkTimeout = setTimeout(() => {
                        rgthree.monitorBadLinks();
                    }, 5000);
                }
            }, 100);
            loadGraphData && loadGraphData.call(app, ...arguments);
        };
    }
    getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node) {
        var _a, _b, _c;
        return ((_c = (_b = (_a = this.initialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff) === null || _a === void 0 ? void 0 : _a.nodes) === null || _b === void 0 ? void 0 : _b.find((n) => n.id === node.id)) !== null && _c !== void 0 ? _c : null);
    }
    async showMessage(data) {
        let container = document.querySelector(".rgthree-top-messages-container");
        if (!container) {
            container = document.createElement("div");
            container.classList.add("rgthree-top-messages-container");
            document.body.appendChild(container);
        }
        await this.hideMessage(data.id);
        const messageContainer = document.createElement("div");
        messageContainer.setAttribute("type", data.type || "info");
        const message = document.createElement("span");
        message.innerText = data.message;
        messageContainer.appendChild(message);
        for (let a = 0; a < (data.actions || []).length; a++) {
            const action = data.actions[a];
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
                    return action.callback(e);
                };
            }
            messageContainer.appendChild(actionEl);
        }
        const messageAnimContainer = document.createElement("div");
        messageAnimContainer.setAttribute("msg-id", data.id);
        messageAnimContainer.appendChild(messageContainer);
        container.appendChild(messageAnimContainer);
        await wait(64);
        messageAnimContainer.style.marginTop = `-${messageAnimContainer.offsetHeight}px`;
        await wait(64);
        messageAnimContainer.classList.add("-show");
        if (data.timeout) {
            await wait(data.timeout);
            this.hideMessage(data.id);
        }
    }
    async hideMessage(id) {
        const msg = document.querySelector(`.rgthree-top-messages-container > [msg-id="${id}"]`);
        if (msg === null || msg === void 0 ? void 0 : msg.classList.contains("-show")) {
            msg.classList.remove("-show");
            await wait(750);
        }
        msg && msg.remove();
    }
    async clearAllMessages() {
        let container = document.querySelector(".rgthree-top-messages-container");
        container && (container.innerHTML = "");
    }
    handleKeydown(e) {
        this.ctrlKey = !!e.ctrlKey;
        this.altKey = !!e.altKey;
        this.metaKey = !!e.metaKey;
        this.shiftKey = !!e.shiftKey;
        this.downKeys[e.key.toLocaleUpperCase()] = true;
        this.downKeys["^" + e.key.toLocaleUpperCase()] = true;
    }
    handleKeyup(e) {
        this.ctrlKey = !!e.ctrlKey;
        this.altKey = !!e.altKey;
        this.metaKey = !!e.metaKey;
        this.shiftKey = !!e.shiftKey;
        this.downKeys[e.key.toLocaleUpperCase()] = false;
        this.downKeys["^" + e.key.toLocaleUpperCase()] = false;
    }
    areAllKeysDown(keys, caseSensitive = false) {
        return keys.every((k) => {
            if (caseSensitive) {
                return rgthree.downKeys["^" + k.trim()];
            }
            return rgthree.downKeys[k.trim().toUpperCase()];
        });
    }
    injectRgthreeCss() {
        let link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = "extensions/rgthree-comfy/rgthree.css";
        document.head.appendChild(link);
    }
    setLogLevel(level) {
        GLOBAL_LOG_LEVEL = level;
    }
    log(levelOrMessage, message, ...args) {
        this.logger.log(levelOrMessage, message, ...args);
    }
    newLogSession(name) {
        return this.logger.newSession(name);
    }
    monitorBadLinks() {
        const badLinksFound = fixBadLinks(app.graph);
        if (badLinksFound.hasBadLinks && !this.monitorBadLinksAlerted) {
            this.monitorBadLinksAlerted = true;
            alert(`Problematic links just found in live data. Can you save your workflow and file a bug with ` +
                `the last few steps you took to trigger this at ` +
                `https://github.com/rgthree/rgthree-comfy/issues. Thank you!`);
        }
        else if (!badLinksFound.hasBadLinks) {
            this.monitorBadLinksAlerted = false;
        }
        this.monitorLinkTimeout = setTimeout(() => {
            this.monitorBadLinks();
        }, 5000);
    }
}
export const rgthree = new Rgthree();
window.rgthree = rgthree;
