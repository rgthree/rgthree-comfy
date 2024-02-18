import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
import { fixBadLinks } from "../../rgthree/common/link_fixer.js";
import { wait } from "../../rgthree/common/shared_utils.js";
import { replaceNode, waitForCanvas, waitForGraph } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { RgthreeProgressBar } from "../../rgthree/common/progress_bar.js";
import { RgthreeConfigDialog } from "./config.js";
import { iconGear, iconReplace, iconStarFilled, logoRgthree } from "../../rgthree/common/media/svgs.js";
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["IMPORTANT"] = 1] = "IMPORTANT";
    LogLevel[LogLevel["ERROR"] = 2] = "ERROR";
    LogLevel[LogLevel["WARN"] = 3] = "WARN";
    LogLevel[LogLevel["INFO"] = 4] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 5] = "DEBUG";
})(LogLevel || (LogLevel = {}));
const LogLevelKeyToLogLevel = {
    IMPORTANT: LogLevel.IMPORTANT,
    ERROR: LogLevel.ERROR,
    WARN: LogLevel.WARN,
    INFO: LogLevel.INFO,
    DEBUG: LogLevel.DEBUG,
};
const LogLevelToMethod = {
    [LogLevel.IMPORTANT]: "log",
    [LogLevel.ERROR]: "error",
    [LogLevel.WARN]: "warn",
    [LogLevel.INFO]: "info",
    [LogLevel.DEBUG]: "debug",
};
const LogLevelToCSS = {
    [LogLevel.IMPORTANT]: "font-weight: bold; color: blue;",
    [LogLevel.ERROR]: "",
    [LogLevel.WARN]: "",
    [LogLevel.INFO]: "font-style: italic; color: blue;",
    [LogLevel.DEBUG]: "font-style: italic; color: #333;",
};
let GLOBAL_LOG_LEVEL = LogLevel.ERROR;
class Logger {
    log(level, message, ...args) {
        var _a;
        const [n, v] = this.logParts(level, message, ...args);
        (_a = console[n]) === null || _a === void 0 ? void 0 : _a.call(console, ...v);
    }
    logParts(level, message, ...args) {
        if (level <= GLOBAL_LOG_LEVEL) {
            const css = LogLevelToCSS[level] || "";
            return [LogLevelToMethod[level], [`%c${message}`, css, ...args]];
        }
        return ["none", []];
    }
}
class LogSession {
    constructor(name) {
        this.name = name;
        this.logger = new Logger();
    }
    log(levelOrMessage, message, ...args) {
        var _a;
        const [n, v] = this.logParts(levelOrMessage, message, ...args);
        (_a = console[n]) === null || _a === void 0 ? void 0 : _a.call(console, ...v);
    }
    logParts(levelOrMessage, message, ...args) {
        let level = typeof levelOrMessage === "string" ? LogLevel.INFO : levelOrMessage;
        message = typeof levelOrMessage === "string" ? levelOrMessage : message;
        return this.logger.logParts(level, `${this.name || ""}${message ? " " + message : ""}`, ...args);
    }
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }
    debugParts(message, ...args) {
        return this.logParts(LogLevel.DEBUG, message, ...args);
    }
    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }
    infoParts(message, ...args) {
        return this.logParts(LogLevel.INFO, message, ...args);
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
        var _a;
        super();
        this.api = api;
        this.settingsDialog = null;
        this.progressBarEl = null;
        this.queueNodeIds = null;
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
        const logLevel = (_a = LogLevelKeyToLogLevel[CONFIG_SERVICE.getConfigValue("log_level")]) !== null && _a !== void 0 ? _a : GLOBAL_LOG_LEVEL;
        this.setLogLevel(logLevel);
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
        CONFIG_SERVICE.addEventListener("config-change", ((e) => {
            var _a, _b;
            if ((_b = (_a = e.detail) === null || _a === void 0 ? void 0 : _a.key) === null || _b === void 0 ? void 0 : _b.includes("features.progress_bar")) {
                this.initializeProgressBar();
            }
        }));
    }
    initializeProgressBar() {
        var _a;
        if (CONFIG_SERVICE.getConfigValue("features.progress_bar.enabled")) {
            if (!this.progressBarEl) {
                this.progressBarEl = RgthreeProgressBar.create();
                this.progressBarEl.addEventListener("contextmenu", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });
                this.progressBarEl.addEventListener("pointerdown", async (e) => {
                    var _a;
                    LiteGraph.closeAllContextMenus();
                    if (e.button == 2) {
                        const canvas = await waitForCanvas();
                        new LiteGraph.ContextMenu(this.getRgthreeContextMenuItems(), {
                            title: `<div class="rgthree-contextmenu-item rgthree-contextmenu-title-rgthree-comfy">${logoRgthree} rgthree-comfy</div>`,
                            left: e.clientX,
                            top: 5,
                        }, canvas.getCanvasWindow());
                        return;
                    }
                    if (e.button == 0) {
                        const nodeId = (_a = this.progressBarEl) === null || _a === void 0 ? void 0 : _a.currentNodeId;
                        if (nodeId) {
                            const [canvas, graph] = await Promise.all([waitForCanvas(), waitForGraph()]);
                            const node = graph.getNodeById(Number(nodeId));
                            if (node) {
                                canvas.centerOnNode(node);
                                e.stopPropagation();
                                e.preventDefault();
                            }
                        }
                        return;
                    }
                });
            }
            if (!this.progressBarEl.parentElement) {
                document.body.appendChild(this.progressBarEl);
            }
            const height = CONFIG_SERVICE.getConfigValue("features.progress_bar.height") || 14;
            this.progressBarEl.style.height = `${height}px`;
            const fontSize = Math.max(10, Number(height) - 10);
            this.progressBarEl.style.fontSize = `${fontSize}px`;
            this.progressBarEl.style.fontWeight = fontSize <= 12 ? "bold" : "normal";
            if (CONFIG_SERVICE.getConfigValue("features.progress_bar.position") === "bottom") {
                this.progressBarEl.style.bottom = `0px`;
                this.progressBarEl.style.top = `auto`;
            }
            else {
                this.progressBarEl.style.top = `0px`;
                this.progressBarEl.style.bottom = `auto`;
            }
        }
        else {
            (_a = this.progressBarEl) === null || _a === void 0 ? void 0 : _a.remove();
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
        const that = this;
        setTimeout(async () => {
            const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
            LGraphCanvas.prototype.getCanvasMenuOptions = function (...args) {
                const options = getCanvasMenuOptions.apply(this, [...args]);
                options.push(null);
                options.push({
                    content: logoRgthree + `rgthree-comfy`,
                    className: "rgthree-contextmenu-item rgthree-contextmenu-main-item-rgthree-comfy",
                    submenu: {
                        options: that.getRgthreeContextMenuItems(),
                    },
                });
                return options;
            };
        }, 1000);
    }
    getRgthreeContextMenuItems() {
        const [canvas, graph] = [app.canvas, app.graph];
        const selectedNodes = Object.values(canvas.selected_nodes || {});
        let rerouteNodes = [];
        if (selectedNodes.length) {
            rerouteNodes = selectedNodes.filter((n) => n.type === "Reroute");
        }
        else {
            rerouteNodes = graph._nodes.filter((n) => n.type == "Reroute");
        }
        const rerouteLabel = selectedNodes.length ? "selected" : "all";
        return [
            {
                content: "Actions",
                disabled: true,
                className: "rgthree-contextmenu-item rgthree-contextmenu-label",
            },
            {
                content: iconGear + "Settings (rgthree-comfy)",
                disabled: !!this.settingsDialog,
                className: "rgthree-contextmenu-item",
                callback: (...args) => {
                    this.settingsDialog = new RgthreeConfigDialog().show();
                    this.settingsDialog.addEventListener("close", (e) => {
                        this.settingsDialog = null;
                    });
                },
            },
            {
                content: iconReplace + ` Convert ${rerouteLabel} Reroutes`,
                disabled: !rerouteNodes.length,
                className: "rgthree-contextmenu-item",
                callback: (...args) => {
                    const msg = `Convert ${rerouteLabel} ComfyUI Reroutes to Reroute (rgthree) nodes? \n` +
                        `(First save a copy of your workflow & check reroute connections afterwards)`;
                    if (!window.confirm(msg)) {
                        return;
                    }
                    (async () => {
                        for (const node of [...rerouteNodes]) {
                            if (node.type == "Reroute") {
                                this.replacingReroute = node.id;
                                await replaceNode(node, NodeTypesString.REROUTE);
                                this.replacingReroute = null;
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
                callback: (...args) => {
                    window.open("https://github.com/rgthree/rgthree-comfy", "_blank");
                },
            },
        ];
    }
    async queueOutputNodes(nodeIds) {
        var _a;
        try {
            this.queueNodeIds = nodeIds;
            await app.queuePrompt();
        }
        catch (e) {
            const [n, v] = this.logParts(LogLevel.ERROR, `There was an error queuing nodes ${nodeIds}`, e);
            (_a = console[n]) === null || _a === void 0 ? void 0 : _a.call(console, ...v);
        }
        finally {
            this.queueNodeIds = null;
        }
    }
    recursiveAddNodes(nodeId, oldOutput, newOutput) {
        let currentId = nodeId;
        let currentNode = oldOutput[currentId];
        if (newOutput[currentId] == null) {
            newOutput[currentId] = currentNode;
            for (const inputValue of Object.values(currentNode.inputs || [])) {
                if (Array.isArray(inputValue)) {
                    this.recursiveAddNodes(inputValue[0], oldOutput, newOutput);
                }
            }
        }
        return newOutput;
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
        const apiQueuePrompt = api.queuePrompt;
        api.queuePrompt = async function (index, prompt) {
            var _a;
            if (((_a = rgthree.queueNodeIds) === null || _a === void 0 ? void 0 : _a.length) && prompt.output) {
                const oldOutput = prompt.output;
                let newOutput = {};
                for (const queueNodeId of rgthree.queueNodeIds) {
                    rgthree.recursiveAddNodes(String(queueNodeId), oldOutput, newOutput);
                }
                prompt.output = newOutput;
            }
            return apiQueuePrompt.apply(app, [index, prompt]);
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
                    if (CONFIG_SERVICE.getConfigValue("features.show_alerts_for_corrupt_workflows")) {
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
                                                    if (CONFIG_SERVICE.getConfigValue("features.monitor_for_corrupt_links") ||
                                                        CONFIG_SERVICE.getConfigValue("features.monitor_bad_links")) {
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
                else if (CONFIG_SERVICE.getConfigValue("features.monitor_for_corrupt_links") ||
                    CONFIG_SERVICE.getConfigValue("features.monitor_bad_links")) {
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
        message.innerHTML = data.message;
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
    logParts(levelOrMessage, message, ...args) {
        return this.logger.logParts(levelOrMessage, message, ...args);
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
