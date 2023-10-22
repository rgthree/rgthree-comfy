import type { LGraphNode, SerializedLGraphNode, serializedLGraph } from "litegraph.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import {rgthreeConfig} from "./rgthree_config.js";
import { fixBadLinks } from "./link_fixer.js";
import { wait } from "./shared_utils.js";

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
  type?: 'warn'|null;
  timeout?: number;
  // closeable?: boolean; // TODO
  actions?: Array<{
    label: string;
    href?: string;
    callback?: (event: MouseEvent) => void;
  }>;
}

/**
 * A global class as 'rgthree'; exposed on wiindow. Lots can go in here.
 */
class Rgthree {
  /** Are any functional keys pressed in this given moment? */
  ctrlKey = false;
  altKey = false;
  metaKey = false;
  shiftKey = false;

  logger = new LogSession("[rgthree]");

  monitorBadLinksAlerted = false;
  monitorLinkTimeout: number|null = null;

  async clearAllMessages() {
    let container = document.querySelector('.rgthree-top-messages-container');
    container && (container.innerHTML = '');
  }

  async showMessage(data: RgthreeUiMessage) {
    let container = document.querySelector('.rgthree-top-messages-container');
    if (!container) {
      container = document.createElement('div');
      container.classList.add('rgthree-top-messages-container');
      document.body.appendChild(container);
    }
    // Hide if we exist.
    await this.hideMessage(data.id);

    const messageContainer = document.createElement('div');
    messageContainer.setAttribute('type', data.type || 'info');

    const message = document.createElement('span');
    message.innerText = data.message;
    messageContainer.appendChild(message);

    for (let a = 0; a < (data.actions || []).length; a++) {
      const action = data.actions![a]!;
      if (a > 0) {
        const sep = document.createElement('span');
        sep.innerHTML = '&nbsp;|&nbsp;';
        messageContainer.appendChild(sep);
      }

      const actionEl = document.createElement('a');
      actionEl.innerText = action.label;
      if (action.href) {
        actionEl.target = '_blank';
        actionEl.href = action.href;
      }
      if (action.callback) {
        actionEl.onclick = (e) => {
          return action.callback!(e);
        }
      }
      messageContainer.appendChild(actionEl);
    }

    const messageAnimContainer = document.createElement('div');
    messageAnimContainer.setAttribute('msg-id', data.id);
    messageAnimContainer.appendChild(messageContainer);
    container.appendChild(messageAnimContainer);

    // Add. Wait. Measure. Wait. Anim.
    await wait(64);
    messageAnimContainer.style.marginTop = `-${messageAnimContainer.offsetHeight}px`;
    await wait(64);
    messageAnimContainer.classList.add('-show');

    if (data.timeout) {
      await wait(data.timeout);
      this.hideMessage(data.id);
    }

  }

  async hideMessage(id: string) {
    const msg = document.querySelector(`.rgthree-top-messages-container > [msg-id="${id}"]`);
    if (msg?.classList.contains('-show')) {
      msg.classList.remove('-show');
      await wait(750);
    }
    msg && msg.remove();
  }

  constructor() {
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

    // Override the loadGraphData so we can check for bad links and ask the user to fix them.
    const that = this;

    const queuePrompt = app.queuePrompt as Function;
    app.queuePrompt = async function() {
      that.fireEvent('queue', {});
      let promise = queuePrompt.apply(app, [...arguments]);
      that.fireEvent('queue-end', {});
      return promise;
    }

    const graphToPrompt = app.graphToPrompt as Function;
    app.graphToPrompt = async function() {
      that.fireEvent('graph-to-prompt', {});
      let promise = graphToPrompt.apply(app, [...arguments]);
      await promise;
      that.fireEvent('graph-to-prompt-end', {});
      return promise;
    }

    const clean = app.clean;
    app.clean = function() {
      that.clearAllMessages();
      clean && clean.call(app, ...arguments);
    };

    const loadGraphData = app.loadGraphData;
    app.loadGraphData = function(graph: serializedLGraph) {
      if (that.monitorLinkTimeout) {
        clearTimeout(that.monitorLinkTimeout);
        that.monitorLinkTimeout = null;
      }
      that.clearAllMessages();
      // Try to make a copy to use, because ComfyUI's loadGraphData will modify it.
      let graphCopy: serializedLGraph|null;
      try {
        graphCopy = JSON.parse(JSON.stringify(graph));
      } catch(e) {
        graphCopy = null;
      }
      setTimeout(() => {
        const wasLoadingAborted = document.querySelector('.comfy-modal-content')?.textContent?.includes('Loading aborted due');
        const graphToUse = wasLoadingAborted ? (graphCopy || graph) : app.graph
        const fixBadLinksResult = fixBadLinks(graphToUse);
        if (fixBadLinksResult.hasBadLinks) {
          that.showMessage({
            id: 'bad-links',
            type: 'warn',
            message: 'The workflow you\'ve loaded may have connection/linking data that could be fixed.',
            actions: [
              {
                label: 'Open fixer',
                href: '/extensions/rgthree-comfy/html/links.html',
              },
              {
                label: 'Fix in place',
                href: '/extensions/rgthree-comfy/html/links.html',
                callback: (event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  if (confirm('This will attempt to fix in place. Please make sure to have a saved copy of your workflow.')) {
                    const fixBadLinksResult = fixBadLinks(graphToUse, true);
                    if (!fixBadLinksResult.hasBadLinks) {
                      that.hideMessage('bad-links');
                      alert('Success! It\'s possible some valid links may have been affected. Please check and verify your workflow.');
                      wasLoadingAborted && app.loadGraphData(fixBadLinksResult.graph);
                      if (rgthreeConfig['monitor_bad_links']) {
                        that.monitorLinkTimeout = setTimeout(() => {
                          that.monitorBadLinks();
                        }, 5000);
                      }
                    }
                  }
                }
              },
            ]
          });
        } else if (rgthreeConfig['monitor_bad_links']) {
          that.monitorLinkTimeout = setTimeout(() => {
            that.monitorBadLinks();
          }, 5000);
        }
      }, 100);
      loadGraphData && loadGraphData.call(app, ...arguments);
    }

    wait(100).then(() => {
      this.injectRgthreeCss();
    });
  }

  private injectRgthreeCss() {
    let link = document.createElement("link");
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'extensions/rgthree-comfy/rgthree.css';
    document.head.appendChild(link);
  }

  private readonly eventsToFns = new Map<string, Set<(ev: Event) => void>>();

  addEventListener(event: string, fn: (ev: Event) => void) {
    if (!this.eventsToFns.has(event)) {
      this.eventsToFns.set(event, new Set());
    }
    this.eventsToFns.get(event)!.add(fn);
  }

  removeEventListener(event: string, fn: (ev: Event) => void) {
    if (this.eventsToFns.has(event)) {
      this.eventsToFns.get(event)!.delete(fn);
    }
  }

  fireEvent(event: string, data: any) {
    if (this.eventsToFns.has(event)) {
      for (let fn of this.eventsToFns.get(event)!) {
        const event = new Event(data);
        fn(event);
      }
    }
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
      alert(`Problematic links just found in live data. Can you save your workflow and file a bug with the last few steps you took to trigger this at https://github.com/rgthree/rgthree-comfy/issues. Thank you!`)
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

