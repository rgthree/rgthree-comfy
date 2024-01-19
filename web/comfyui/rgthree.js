import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { rgthreeConfig } from "./rgthree_config.js";
import { fixBadLinks } from "../../rgthree/common/link_fixer.js";
import { wait } from "../../rgthree/common/shared_utils.js";
import { waitForCanvas, waitForGraph } from "./utils.js";
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
        wait(100).then(() => {
            this.injectRgthreeCss();
        });
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
