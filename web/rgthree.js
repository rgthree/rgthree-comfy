import { app } from "../../scripts/app.js";
import { IoDirection } from "./utils.js";
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
let GLOBAL_LOG_LEVEL = LogLevel.WARN;
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
class Rgthree {
    constructor() {
        this.ctrlKey = false;
        this.altKey = false;
        this.metaKey = false;
        this.shiftKey = false;
        this.logger = new LogSession("[rgthree]");
        this.monitorBadLinksAlerted = false;
        window.addEventListener("keydown", (e) => {
            this.ctrlKey = !!e.ctrlKey;
            this.altKey = !!e.altKey;
            this.metaKey = !!e.metaKey;
            this.shiftKey = !!e.shiftKey;
        });
        window.addEventListener("keyup", (e) => {
            this.ctrlKey = !!e.ctrlKey;
            this.altKey = !!e.altKey;
            this.metaKey = !!e.metaKey;
            this.shiftKey = !!e.shiftKey;
        });
        const that = this;
        const loadGraphData = app.loadGraphData;
        app.loadGraphData = function () {
            var _a;
            (_a = document.querySelector('.rgthree-bad-links-alerts-container')) === null || _a === void 0 ? void 0 : _a.remove();
            loadGraphData && loadGraphData.call(app, ...arguments);
            if (that.findBadLinks()) {
                const div = document.createElement('div');
                div.classList.add('rgthree-bad-links-alerts');
                div.innerHTML = `
          <span style="font-size: 18px; margin-right: 4px; display: inline-block; line-height:1">⚠️</span>
          <span style="flex; 1 1 auto; ">
            The workflow you've loaded may have connection/linking data that could be fixed.
          </span>
          <a target="_blank"
              style="color: #fc0; margin-left: 4px; display: inline-block; line-height:1"
              href="/extensions/rgthree-comfy/html/links.html">Open fixer<a>
        `;
                div.style.background = '#353535';
                div.style.color = '#fff';
                div.style.display = 'flex';
                div.style.flexDirection = 'row';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
                div.style.height = 'fit-content';
                div.style.boxShadow = '0 0 10px rgba(0,0,0,0.88)';
                div.style.padding = '6px 12px';
                div.style.borderRadius = '0 0 4px 4px';
                div.style.fontFamily = 'Arial, sans-serif';
                div.style.fontSize = '14px';
                div.style.transform = 'translateY(-100%)';
                div.style.transition = 'transform 0.5s ease-in-out';
                const container = document.createElement('div');
                container.classList.add('rgthree-bad-links-alerts-container');
                container.appendChild(div);
                container.style.position = 'fixed';
                container.style.zIndex = '9999';
                container.style.top = '0';
                container.style.left = '0';
                container.style.width = '100%';
                container.style.height = '0';
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                document.body.appendChild(container);
                setTimeout(() => {
                    const container = document.querySelector('.rgthree-bad-links-alerts');
                    container && (container.style.transform = 'translateY(0%)');
                }, 2000);
            }
        };
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
        this.logger.debug('Starting a monitor for bad links.');
        setInterval(() => {
            const badLinksFound = this.findBadLinks();
            if (badLinksFound && !this.monitorBadLinksAlerted) {
                this.monitorBadLinksAlerted = true;
                alert(`Problematic links just found in data. Can you file a bug with what you've just done at https://github.com/rgthree/rgthree-comfy/issues. Thank you!`);
            }
            else if (!badLinksFound) {
                this.monitorBadLinksAlerted = false;
            }
        }, 1000);
    }
    findBadLinks(fix = false) {
        const patchedNodeSlots = {};
        const findBadLinksLogger = this.newLogSession("[findBadLinks]");
        const data = {
            patchedNodes: [],
            deletedLinks: [],
        };
        function patchNodeSlot(node, ioDir, slot, linkId, op) {
            var _a, _b, _c;
            patchedNodeSlots[node.id] = patchedNodeSlots[node.id] || {};
            const patchedNode = patchedNodeSlots[node.id];
            if (ioDir == IoDirection.INPUT) {
                patchedNode["inputs"] = patchedNode["inputs"] || {};
                if (patchedNode["inputs"][slot] !== undefined) {
                    findBadLinksLogger.log(LogLevel.DEBUG, ` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"][slot]} Skipping.`);
                    return false;
                }
                let linkIdToSet = op === "REMOVE" ? null : linkId;
                patchedNode["inputs"][slot] = linkIdToSet;
                if (fix) {
                    node.inputs[slot].link = linkIdToSet;
                }
            }
            else {
                patchedNode["outputs"] = patchedNode["outputs"] || {};
                patchedNode["outputs"][slot] = patchedNode["outputs"][slot] || {
                    links: [...(((_b = (_a = node.outputs) === null || _a === void 0 ? void 0 : _a[slot]) === null || _b === void 0 ? void 0 : _b.links) || [])],
                    changes: {},
                };
                if (patchedNode["outputs"][slot]["changes"][linkId] !== undefined) {
                    findBadLinksLogger.log(LogLevel.DEBUG, ` > Already set ${node.id}.outputs[${slot}] to ${patchedNode["inputs"][slot]}! Skipping.`);
                    return false;
                }
                patchedNode["outputs"][slot]["changes"][linkId] = op;
                if (op === "ADD") {
                    let linkIdIndex = patchedNode["outputs"][slot]["links"].indexOf(linkId);
                    if (linkIdIndex !== -1) {
                        findBadLinksLogger.log(LogLevel.DEBUG, ` > Hmmm.. asked to add ${linkId} but it is already in list...`);
                        return false;
                    }
                    patchedNode["outputs"][slot]["links"].push(linkId);
                    if (fix) {
                        (_c = node.outputs[slot].links) === null || _c === void 0 ? void 0 : _c.push(linkId);
                    }
                }
                else {
                    let linkIdIndex = patchedNode["outputs"][slot]["links"].indexOf(linkId);
                    if (linkIdIndex === -1) {
                        findBadLinksLogger.log(LogLevel.DEBUG, ` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`);
                        return false;
                    }
                    patchedNode["outputs"][slot]["links"].splice(linkIdIndex, 1);
                    if (fix) {
                        node.outputs[slot].links.splice(linkIdIndex, 1);
                    }
                }
            }
            data.patchedNodes.push(node);
            return true;
        }
        function nodeHasLinkId(node, ioDir, slot, linkId) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            let has = false;
            if (ioDir === IoDirection.INPUT) {
                let nodeHasIt = ((_a = node.inputs[slot]) === null || _a === void 0 ? void 0 : _a.link) === linkId;
                if ((_b = patchedNodeSlots[node.id]) === null || _b === void 0 ? void 0 : _b["inputs"]) {
                    let patchedHasIt = patchedNodeSlots[node.id]["inputs"][slot] === linkId;
                    if (fix && nodeHasIt !== patchedHasIt) {
                        throw Error("Error. Expected node to match patched data.");
                    }
                    has = patchedHasIt;
                }
                else {
                    has = !!nodeHasIt;
                }
            }
            else {
                let nodeHasIt = (_d = (_c = node.outputs[slot]) === null || _c === void 0 ? void 0 : _c.links) === null || _d === void 0 ? void 0 : _d.includes(linkId);
                if ((_g = (_f = (_e = patchedNodeSlots[node.id]) === null || _e === void 0 ? void 0 : _e["outputs"]) === null || _f === void 0 ? void 0 : _f[slot]) === null || _g === void 0 ? void 0 : _g["changes"][linkId]) {
                    let patchedHasIt = (_h = patchedNodeSlots[node.id]["outputs"][slot]) === null || _h === void 0 ? void 0 : _h.links.includes(linkId);
                    if (fix && nodeHasIt !== patchedHasIt) {
                        throw Error("Error. Expected node to match patched data.");
                    }
                    has = !!patchedHasIt;
                }
                else {
                    has = !!nodeHasIt;
                }
            }
            return has;
        }
        function nodeHasAnyLink(node, ioDir, slot) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            let hasAny = false;
            if (ioDir === IoDirection.INPUT) {
                let nodeHasAny = ((_a = node.inputs[slot]) === null || _a === void 0 ? void 0 : _a.link) != null;
                if ((_b = patchedNodeSlots[node.id]) === null || _b === void 0 ? void 0 : _b["inputs"]) {
                    let patchedHasAny = patchedNodeSlots[node.id]["inputs"][slot] != null;
                    if (fix && nodeHasAny !== patchedHasAny) {
                        throw Error("Error. Expected node to match patched data.");
                    }
                    hasAny = patchedHasAny;
                }
                else {
                    hasAny = !!nodeHasAny;
                }
            }
            else {
                let nodeHasAny = (_d = (_c = node.outputs[slot]) === null || _c === void 0 ? void 0 : _c.links) === null || _d === void 0 ? void 0 : _d.length;
                if ((_g = (_f = (_e = patchedNodeSlots[node.id]) === null || _e === void 0 ? void 0 : _e["outputs"]) === null || _f === void 0 ? void 0 : _f[slot]) === null || _g === void 0 ? void 0 : _g["changes"]) {
                    let patchedHasAny = (_h = patchedNodeSlots[node.id]["outputs"][slot]) === null || _h === void 0 ? void 0 : _h.links.length;
                    if (fix && nodeHasAny !== patchedHasAny) {
                        throw Error("Error. Expected node to match patched data.");
                    }
                    hasAny = !!patchedHasAny;
                }
                else {
                    hasAny = !!nodeHasAny;
                }
            }
            return hasAny;
        }
        const linksReverse = [...app.graph.links];
        linksReverse.reverse();
        for (let link of linksReverse) {
            if (!link)
                continue;
            const originNode = app.graph.getNodeById(link.origin_id);
            const originHasLink = () => nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id);
            const patchOrigin = (op, id = link.id) => patchNodeSlot(originNode, IoDirection.OUTPUT, link.origin_slot, id, op);
            const targetNode = app.graph.getNodeById(link.target_id);
            const targetHasLink = () => nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id);
            const targetHasAnyLink = () => nodeHasAnyLink(targetNode, IoDirection.INPUT, link.target_slot);
            const patchTarget = (op, id = link.id) => patchNodeSlot(targetNode, IoDirection.INPUT, link.target_slot, id, op);
            const originLog = `origin(${link.origin_id}).outputs[${link.origin_slot}].links`;
            const targetLog = `target(${link.target_id}).inputs[${link.target_slot}].link`;
            if (!originNode || !targetNode) {
                if (!originNode && !targetNode) {
                    findBadLinksLogger.info(`Link ${link.id} is invalid, ` +
                        `both origin ${link.origin_id} and target ${link.target_id} do not exist`);
                }
                else if (!originNode) {
                    findBadLinksLogger.info(`Link ${link.id} is funky... ` +
                        `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`);
                    if (targetHasLink()) {
                        findBadLinksLogger.info(` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`);
                        patchTarget("REMOVE", -1);
                    }
                }
                else if (!targetNode) {
                    findBadLinksLogger.info(`Link ${link.id} is funky... ` +
                        `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`);
                    if (originHasLink()) {
                        findBadLinksLogger.info(` > [PATCH] Origin's links' has ${link.id}; will remove the link first.`);
                        patchOrigin("REMOVE");
                    }
                }
                continue;
            }
            if (targetHasLink() || originHasLink()) {
                if (!originHasLink()) {
                    findBadLinksLogger.info(`${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`);
                    findBadLinksLogger.info(` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`);
                    patchOrigin("ADD");
                }
                else if (!targetHasLink()) {
                    findBadLinksLogger.info(`${link.id} is funky... ${targetLog} is NOT correct (is ${targetNode === null || targetNode === void 0 ? void 0 : targetNode.inputs[link.target_slot].link}), but ${originLog} contains it`);
                    if (!targetHasAnyLink()) {
                        findBadLinksLogger.info(` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`);
                        let patched = patchTarget("ADD");
                        if (!patched) {
                            findBadLinksLogger.info(` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`);
                            patched = patchOrigin("REMOVE");
                        }
                    }
                    else {
                        findBadLinksLogger.info(` > [PATCH] ${targetLog} is defined, removing ${link.id} from ${originLog}.`);
                        patchOrigin("REMOVE");
                    }
                }
            }
        }
        for (let link of linksReverse) {
            if (!link)
                continue;
            const originNode = app.graph.getNodeById(link.origin_id);
            const targetNode = app.graph.getNodeById(link.target_id);
            if ((!originNode ||
                !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
                (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))) {
                findBadLinksLogger.info(`${link.id} is def invalid; BOTH origin node ${link.origin_id} ${originNode ? "is removed" : `doesn\'t have ${link.id}`} and ${link.origin_id} target node ${link.target_id ? "is removed" : `doesn\'t have ${link.id}`}.`);
                data.deletedLinks.push(link.id);
                continue;
            }
        }
        if (fix) {
            for (let i = data.deletedLinks.length - 1; i >= 0; i--) {
                findBadLinksLogger.log(LogLevel.DEBUG, `Deleting link #${data.deletedLinks[i]}.`);
                delete app.graph.links[data.deletedLinks[i]];
            }
        }
        if (!data.patchedNodes.length && !data.deletedLinks.length) {
            findBadLinksLogger.log(LogLevel.IMPORTANT, `No bad links detected.`);
            return false;
        }
        findBadLinksLogger.log(LogLevel.IMPORTANT, `${fix ? "Made" : "Would make"} ${data.patchedNodes.length || "no"} node link patches, and ${data.deletedLinks.length || "no"} stale link removals.`, !fix && `Head to ${location.origin}/extensions/rgthree-comfy/html/links.html to fix workflows.`);
        return true;
    }
}
export const rgthree = new Rgthree();
window.rgthree = rgthree;
