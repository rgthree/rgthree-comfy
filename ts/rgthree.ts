import type { LGraphNode } from "litegraph.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import { IoDirection } from "./utils.js";

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

let GLOBAL_LOG_LEVEL = LogLevel.WARN;

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
    const loadGraphData = app.loadGraphData;
    app.loadGraphData = function() {
      document.querySelector('.rgthree-bad-links-alerts-container')?.remove();
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
          const container = document.querySelector('.rgthree-bad-links-alerts') as HTMLElement;
          container && (container.style.transform = 'translateY(0%)');
        }, 2000);

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
    this.logger.debug('Starting a monitor for bad links.');
    setInterval(() => {
      const badLinksFound = this.findBadLinks();
      if (badLinksFound && !this.monitorBadLinksAlerted) {
        this.monitorBadLinksAlerted = true;
        alert(`Problematic links just found in data. Can you file a bug with what you've just done at https://github.com/rgthree/rgthree-comfy/issues. Thank you!`)
      } else if (!badLinksFound) {
        // Clear the alert once fixed so we can alert again.
        this.monitorBadLinksAlerted = false;
      }
    }, 1000);
  }

  /**
   * Sometimes there are bad links in the app.graph.links which can sometimes play poorly with our
   * nodes. This method finds them and, if `fix` is true, will attempt to fix them.
   *
   * Most of the time, the bad links are old links that that has out of date input or output data.
   */
  findBadLinks(fix = false) {
    const patchedNodeSlots: {
      [nodeId: string]: {
        inputs?: { [slot: number]: number | null };
        outputs?: {
          [slots: number]: {
            links: number[];
            changes: { [linkId: number]: "ADD" | "REMOVE" };
          };
        };
      };
    } = {};
    const findBadLinksLogger = this.newLogSession("[findBadLinks]");
    const data: { patchedNodes: LGraphNode[]; deletedLinks: number[] } = {
      patchedNodes: [],
      deletedLinks: [],
    };

    /**
     * Internal patch node. We keep track of changes in patchedNodeSlots in case we're in a dry run.
     */
    function patchNodeSlot(
      node: LGraphNode,
      ioDir: IoDirection,
      slot: number,
      linkId: number,
      op: "ADD" | "REMOVE",
    ) {
      patchedNodeSlots[node.id] = patchedNodeSlots[node.id] || {};
      const patchedNode = patchedNodeSlots[node.id]!;
      if (ioDir == IoDirection.INPUT) {
        patchedNode["inputs"] = patchedNode["inputs"] || {};
        // We can set to null (delete), so undefined means we haven't set it at all.
        if (patchedNode["inputs"]![slot] !== undefined) {
          findBadLinksLogger.log(
            LogLevel.DEBUG,
            ` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"]![
              slot
            ]!} Skipping.`,
          );
          return false;
        }
        let linkIdToSet = op === "REMOVE" ? null : linkId;
        patchedNode["inputs"]![slot] = linkIdToSet;
        if (fix) {
          node.inputs[slot]!.link = linkIdToSet;
        }
      } else {
        patchedNode["outputs"] = patchedNode["outputs"] || {};
        patchedNode["outputs"]![slot] = patchedNode["outputs"]![slot] || {
          links: [...(node.outputs?.[slot]?.links || [])],
          changes: {},
        };
        if (patchedNode["outputs"]![slot]!["changes"]![linkId] !== undefined) {
          findBadLinksLogger.log(
            LogLevel.DEBUG,
            ` > Already set ${node.id}.outputs[${slot}] to ${
              patchedNode["inputs"]![slot]
            }! Skipping.`,
          );
          return false;
        }
        patchedNode["outputs"]![slot]!["changes"]![linkId] = op;
        if (op === "ADD") {
          let linkIdIndex = patchedNode["outputs"]![slot]!["links"].indexOf(linkId);
          if (linkIdIndex !== -1) {
            findBadLinksLogger.log(
              LogLevel.DEBUG,
              ` > Hmmm.. asked to add ${linkId} but it is already in list...`,
            );
            return false;
          }
          patchedNode["outputs"]![slot]!["links"].push(linkId);
          if (fix) {
            node.outputs[slot]!.links?.push(linkId);
          }
        } else {
          let linkIdIndex = patchedNode["outputs"]![slot]!["links"].indexOf(linkId);
          if (linkIdIndex === -1) {
            findBadLinksLogger.log(
              LogLevel.DEBUG,
              ` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`,
            );
            return false;
          }
          patchedNode["outputs"]![slot]!["links"].splice(linkIdIndex, 1);
          if (fix) {
            node.outputs[slot]!.links!.splice(linkIdIndex, 1);
          }
        }
      }
      data.patchedNodes.push(node);
      return true;
    }

    /**
     * Internal to check if a node (or patched data) has a linkId.
     */
    function nodeHasLinkId(node: LGraphNode, ioDir: IoDirection, slot: number, linkId: number) {
      // Patched data should be canonical. We can double check if fixing too.
      let has = false;
      if (ioDir === IoDirection.INPUT) {
        let nodeHasIt = node.inputs[slot]?.link === linkId;
        if (patchedNodeSlots[node.id]?.["inputs"]) {
          let patchedHasIt = patchedNodeSlots[node.id]!["inputs"]![slot] === linkId;
          // If we're fixing, double check that node matches.
          if (fix && nodeHasIt !== patchedHasIt) {
            throw Error("Error. Expected node to match patched data.");
          }
          has = patchedHasIt;
        } else {
          has = !!nodeHasIt;
        }
      } else {
        let nodeHasIt = node.outputs[slot]?.links?.includes(linkId);
        if (patchedNodeSlots[node.id]?.["outputs"]?.[slot]?.["changes"][linkId]) {
          let patchedHasIt = patchedNodeSlots[node.id]!["outputs"]![slot]?.links.includes(linkId);
          // If we're fixing, double check that node matches.
          if (fix && nodeHasIt !== patchedHasIt) {
            throw Error("Error. Expected node to match patched data.");
          }
          has = !!patchedHasIt;
        } else {
          has = !!nodeHasIt;
        }
      }
      return has;
    }

    /**
     * Internal to check if a node (or patched data) has a linkId.
     */
    function nodeHasAnyLink(node: LGraphNode, ioDir: IoDirection, slot: number) {
      // Patched data should be canonical. We can double check if fixing too.
      let hasAny = false;
      if (ioDir === IoDirection.INPUT) {
        let nodeHasAny = node.inputs[slot]?.link != null;
        if (patchedNodeSlots[node.id]?.["inputs"]) {
          let patchedHasAny = patchedNodeSlots[node.id]!["inputs"]![slot] != null;
          // If we're fixing, double check that node matches.
          if (fix && nodeHasAny !== patchedHasAny) {
            throw Error("Error. Expected node to match patched data.");
          }
          hasAny = patchedHasAny;
        } else {
          hasAny = !!nodeHasAny;
        }
      } else {
        let nodeHasAny = node.outputs[slot]?.links?.length;
        if (patchedNodeSlots[node.id]?.["outputs"]?.[slot]?.["changes"]) {
          let patchedHasAny = patchedNodeSlots[node.id]!["outputs"]![slot]?.links.length;
          // If we're fixing, double check that node matches.
          if (fix && nodeHasAny !== patchedHasAny) {
            throw Error("Error. Expected node to match patched data.");
          }
          hasAny = !!patchedHasAny;
        } else {
          hasAny = !!nodeHasAny;
        }
      }
      return hasAny;
    }

    const linksReverse = [...app.graph.links];
    linksReverse.reverse();
    for (let link of linksReverse) {
      if (!link) continue;

      const originNode = app.graph.getNodeById(link.origin_id);
      const originHasLink = () =>
        nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id);
      const patchOrigin = (op: "ADD" | "REMOVE", id = link.id) =>
        patchNodeSlot(originNode, IoDirection.OUTPUT, link.origin_slot, id, op);

      const targetNode = app.graph.getNodeById(link.target_id);
      const targetHasLink = () =>
        nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id);
      const targetHasAnyLink = () =>
        nodeHasAnyLink(targetNode, IoDirection.INPUT, link.target_slot);
      const patchTarget = (op: "ADD" | "REMOVE", id = link.id) =>
        patchNodeSlot(targetNode, IoDirection.INPUT, link.target_slot, id, op);

      const originLog = `origin(${link.origin_id}).outputs[${link.origin_slot}].links`;
      const targetLog = `target(${link.target_id}).inputs[${link.target_slot}].link`;

      if (!originNode || !targetNode) {
        if (!originNode && !targetNode) {
          findBadLinksLogger.info(
            `Link ${link.id} is invalid, ` +
              `both origin ${link.origin_id} and target ${link.target_id} do not exist`,
          );
        } else if (!originNode) {
          findBadLinksLogger.info(
            `Link ${link.id} is funky... ` +
              `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`,
          );
          if (targetHasLink()) {
            findBadLinksLogger.info(
              ` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`,
            );
            patchTarget("REMOVE", -1);
          }
        } else if (!targetNode) {
          findBadLinksLogger.info(
            `Link ${link.id} is funky... ` +
              `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`,
          );
          if (originHasLink()) {
            findBadLinksLogger.info(
              ` > [PATCH] Origin's links' has ${link.id}; will remove the link first.`,
            );
            patchOrigin("REMOVE");
          }
        }
        continue;
      }

      if (targetHasLink() || originHasLink()) {
        if (!originHasLink()) {
          findBadLinksLogger.info(
            `${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`,
          );
          findBadLinksLogger.info(
            ` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`,
          );
          patchOrigin("ADD");
        } else if (!targetHasLink()) {
          findBadLinksLogger.info(
            `${link.id} is funky... ${targetLog} is NOT correct (is ${targetNode?.inputs[
              link.target_slot
            ].link}), but ${originLog} contains it`,
          );
          if (!targetHasAnyLink()) {
            findBadLinksLogger.info(
              ` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`,
            );
            let patched = patchTarget("ADD");
            if (!patched) {
              findBadLinksLogger.info(
                ` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`,
              );
              patched = patchOrigin("REMOVE");
            }
          } else {
            findBadLinksLogger.info(
              ` > [PATCH] ${targetLog} is defined, removing ${link.id} from ${originLog}.`,
            );
            patchOrigin("REMOVE");
          }
        }
      }
    }

    // Now that we've cleaned up the inputs, outputs, run through it looking for dangling links.,
    for (let link of linksReverse) {
      if (!link) continue;
      const originNode = app.graph.getNodeById(link.origin_id);
      const targetNode = app.graph.getNodeById(link.target_id);
      // Now that we've manipulated the linking, check again if they both exist.
      if (
        (!originNode ||
          !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
        (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))
      ) {
        findBadLinksLogger.info(
          `${link.id} is def invalid; BOTH origin node ${link.origin_id} ${
            originNode ? "is removed" : `doesn\'t have ${link.id}`
          } and ${link.origin_id} target node ${
            link.target_id ? "is removed" : `doesn\'t have ${link.id}`
          }.`,
        );
        data.deletedLinks.push(link.id);
        continue;
      }
    }

    // If we're fixing, then we've been patching along the way. Now go through and actually delete
    // the zombie links from `app.graph.links`
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
    findBadLinksLogger.log(
      LogLevel.IMPORTANT,
      `${fix ? "Made" : "Would make"} ${
        data.patchedNodes.length || "no"
      } node link patches, and ${data.deletedLinks.length || "no"} stale link removals.`,
      !fix && `Head to ${location.origin}/extensions/rgthree-comfy/html/links.html to fix workflows.`
    );
    return true;
  }
}

export const rgthree = new Rgthree();
// @ts-ignore. Expose it on window because, why not.
window.rgthree = rgthree;
