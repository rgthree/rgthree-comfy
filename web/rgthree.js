import { app } from "../../scripts/app.js";
import { rgthreeConfig } from "./rgthree_config.js";
import { fixBadLinks } from "./link_fixer.js";
import { wait } from "./shared_utils.js";
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
class Rgthree {
    constructor() {
        this.ctrlKey = false;
        this.altKey = false;
        this.metaKey = false;
        this.shiftKey = false;
        this.logger = new LogSession("[rgthree]");
        this.monitorBadLinksAlerted = false;
        this.monitorLinkTimeout = null;
        this.eventsToFns = new Map();
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
        const queuePrompt = app.queuePrompt;
        app.queuePrompt = async function () {
            that.fireEvent('queue', {});
            let promise = queuePrompt.apply(app, [...arguments]);
            that.fireEvent('queue-end', {});
            return promise;
        };
        const graphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            that.fireEvent('graph-to-prompt', {});
            let promise = graphToPrompt.apply(app, [...arguments]);
            await promise;
            that.fireEvent('graph-to-prompt-end', {});
            return promise;
        };
        const clean = app.clean;
        app.clean = function () {
            var _a;
            (_a = document.querySelector('.rgthree-bad-links-alerts-container')) === null || _a === void 0 ? void 0 : _a.remove();
            clean && clean.call(app, ...arguments);
        };
        const loadGraphData = app.loadGraphData;
        app.loadGraphData = function (graph) {
            var _a;
            if (this.monitorLinkTimeout) {
                clearTimeout(this.monitorLinkTimeout);
                this.monitorLinkTimeout = null;
            }
            (_a = document.querySelector('.rgthree-bad-links-alerts-container')) === null || _a === void 0 ? void 0 : _a.remove();
            let graphCopy;
            try {
                graphCopy = JSON.parse(JSON.stringify(graph));
            }
            catch (e) {
                graphCopy = null;
            }
            setTimeout(() => {
                var _a, _b, _c;
                const wasLoadingAborted = (_b = (_a = document.querySelector('.comfy-modal-content')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.includes('Loading aborted due');
                const graphToUse = wasLoadingAborted ? (graphCopy || graph) : app.graph;
                const fixBadLinksResult = fixBadLinks(graphToUse);
                if (fixBadLinksResult.hasBadLinks) {
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
            <span>&nbsp;|&nbsp;</span>
            <a class="fix-in-place" target="_blank"
                style="cursor: pointer; text-decoration: underline; color: #fc0; margin-left: 4px; display: inline-block; line-height:1"
                >Fix in place<a>
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
                    (_c = div.querySelector('.fix-in-place')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', (event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        if (confirm('This will attempt to fix in place. Please make sure to have a saved copy of your workflow.')) {
                            const fixBadLinksResult = fixBadLinks(graphToUse, true);
                            if (!fixBadLinksResult.hasBadLinks) {
                                alert('Success! It\'s possible some valid links may have been affected. Please check and verify your workflow.');
                                wasLoadingAborted && app.loadGraphData(fixBadLinksResult.graph);
                                container.remove();
                                if (rgthreeConfig['monitor_bad_links']) {
                                    that.monitorLinkTimeout = setTimeout(() => {
                                        that.monitorBadLinks();
                                    }, 5000);
                                }
                            }
                        }
                    });
                    setTimeout(() => {
                        const container = document.querySelector('.rgthree-bad-links-alerts');
                        container && (container.style.transform = 'translateY(0%)');
                    }, 500);
                }
                else if (rgthreeConfig['monitor_bad_links']) {
                    that.monitorLinkTimeout = setTimeout(() => {
                        that.monitorBadLinks();
                    }, 5000);
                }
            }, 100);
            loadGraphData && loadGraphData.call(app, ...arguments);
        };
        wait(100).then(() => {
            this.injectRgthreeCss();
        });
    }
    injectRgthreeCss() {
        let link = document.createElement("link");
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'extensions/rgthree-comfy/rgthree.css';
        document.head.appendChild(link);
    }
    addEventListener(event, fn) {
        if (!this.eventsToFns.has(event)) {
            this.eventsToFns.set(event, new Set());
        }
        this.eventsToFns.get(event).add(fn);
    }
    removeEventListener(event, fn) {
        if (this.eventsToFns.has(event)) {
            this.eventsToFns.get(event).delete(fn);
        }
    }
    fireEvent(event, data) {
        if (this.eventsToFns.has(event)) {
            for (let fn of this.eventsToFns.get(event)) {
                const event = new Event(data);
                fn(event);
            }
        }
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
            alert(`Problematic links just found in live data. Can you save your workflow and file a bug with the last few steps you took to trigger this at https://github.com/rgthree/rgthree-comfy/issues. Thank you!`);
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
