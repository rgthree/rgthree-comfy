// @ts-ignore
import { getPngMetadata } from "/scripts/pnginfo.js";

type SerializedLink = [
  number, // this.id,
  number, // this.origin_id,
  number, // this.origin_slot,
  number, // this.target_id,
  number, // this.target_slot,
  number, // this.type
];

interface SerializedNodeInput {
  name: string;
  type: string;
  link: number;
}
interface SerializedNodeOutput {
  name: string;
  type: string;
  link: number;
  slot_index: number;
  links: number[];
}
interface SerializedNode {
  id: number;
  inputs: SerializedNodeInput[];
  outputs: SerializedNodeOutput[];
  mode: number;
  order: number;
  pos: [number, number];
  properties: any;
  size: [number, number];
  type: string;
  widgets_values: Array<number | string>;
}

interface SerializedGraph {
  config: any;
  extra: any;
  groups: any;
  last_link_id: number;
  last_node_id: number;
  links: SerializedLink[];
  nodes: SerializedNode[];
}

enum IoDirection {
  INPUT,
  OUTPUT,
}

interface BadLinksData {
  fixed: boolean;
  graph: SerializedGraph;
  patched: number;
  deleted: number;
}

function wait(ms = 16, value?: any) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, ms);
  });
}

const logger = {
  logTo: console as Console | HTMLElement,
  log: (...args: any[]) => {
    logger.logTo === console
      ? console.log(...args)
      : ((logger.logTo as HTMLElement).innerText += args.join(",") + "\n");
  },
};

const findBadLinksLogger = {
  log: async (...args: any[]) => {
    logger.log(...args);
    // await wait(48);
  },
};

export class LinkPage {
  private containerEl: HTMLDivElement;
  private figcaptionEl: HTMLElement;
  private btnFix: HTMLButtonElement;
  private outputeMessageEl: HTMLDivElement;
  private outputImageEl: HTMLImageElement;

  private file?: File | Blob;
  private graph?: SerializedGraph;
  private graphResults?: BadLinksData;
  private graphFinalResults?: BadLinksData;

  constructor() {
    // const consoleEl = document.getElementById("console")!;
    this.containerEl = document.querySelector(".box")!;
    this.figcaptionEl = document.querySelector("figcaption")!;
    this.outputeMessageEl = document.querySelector(".output")!;
    this.outputImageEl = document.querySelector(".output-image")!;
    this.btnFix = document.querySelector(".btn-fix")!;

    // Need to prevent on dragover to allow drop...
    document.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
      },
      false,
    );
    document.addEventListener("drop", (e) => {
      this.onDrop(e);
    });
    this.btnFix.addEventListener("click", (e) => {
      this.onFixClick(e);
    });
  }

  private async onFixClick(e: MouseEvent) {
    if (!this.graphResults || !this.graph) {
      this.updateUi("⛔ Fix button click without results.");
      return;
    }
    // Fix
    let graphFinalResults = await fixBadLinks(this.graph, true);
    // Confirm
    graphFinalResults = await fixBadLinks(graphFinalResults.graph, true);
    // This should have happened, but try to run it through again if there's till an issue.
    if (graphFinalResults.patched || graphFinalResults.deleted) {
      graphFinalResults = await fixBadLinks(graphFinalResults.graph, true);
    }
    // Final Confirm
    if (graphFinalResults.patched || graphFinalResults.deleted) {
      this.updateUi("⛔ Hmm... Still detecting bad links. Can you file an issue at https://github.com/rgthree/rgthree-comfy/issues with your image/workflow.");
      return
    }
    this.graphFinalResults = graphFinalResults;
    if (await this.saveFixedWorkflow()) {
      this.updateUi("✅ Workflow fixed.<br><br><small>Please load new saved workflow json and double check linking and execution.</small>");
    }

  }

  private async onDrop(event: DragEvent) {
    if (!event.dataTransfer) {
      return;
    }
    this.reset();

    event.preventDefault();
    event.stopPropagation();

    // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
    if (event.dataTransfer.files.length && event.dataTransfer.files?.[0]?.type !== "image/bmp") {
      await this.handleFile(event.dataTransfer.files[0]!);
      return;
    }

    // Try loading the first URI in the transfer list
    const validTypes = ["text/uri-list", "text/x-moz-url"];
    const match = [...event.dataTransfer.types].find((t) => validTypes.find((v) => t === v));
    if (match) {
      const uri = event.dataTransfer.getData(match)?.split("\n")?.[0];
      if (uri) {
        await this.handleFile(await (await fetch(uri)).blob());
      }
    }
  }

  reset() {
    this.file = undefined;
    this.graph = undefined;
    this.graphResults = undefined;
    this.graphFinalResults = undefined;
    this.updateUi();
  }

  private updateUi(msg?: string) {
    this.outputeMessageEl.innerHTML = "";
    if (this.file && !this.containerEl.classList.contains("-has-file")) {
      this.containerEl.classList.add("-has-file");
      this.figcaptionEl.innerHTML = (this.file as File).name || this.file.type;
      if (this.file.type === "application/json") {
        this.outputImageEl.src = "icon_file_json.png";
      } else {
        const reader = new FileReader();
        reader.onload = () => (this.outputImageEl.src = reader.result as string);
        reader.readAsDataURL(this.file);
      }
    } else if (!this.file && this.containerEl.classList.contains("-has-file")) {
      this.containerEl.classList.remove("-has-file");
      this.outputImageEl.src = "";
      this.outputImageEl.removeAttribute("src");
    }

    if (this.graphResults) {
      this.containerEl.classList.add("-has-results");
      if (!this.graphResults.patched && !this.graphResults.deleted) {
        this.outputeMessageEl.innerHTML = "✅ No bad links detected in the workflow.";
      } else {
        this.containerEl.classList.add("-has-fixable-results");
        this.outputeMessageEl.innerHTML = `⚠️ Found ${this.graphResults.patched} links to fix, and ${this.graphResults.deleted} to be removed.`;
      }
    } else {
      this.containerEl.classList.remove("-has-results");
      this.containerEl.classList.remove("-has-fixable-results");
    }

    if (msg) {
      this.outputeMessageEl.innerHTML = msg;
    }
  }

  private async handleFile(file: File | Blob) {
    this.file = file;
    this.updateUi();

    let workflow: string | null = null;
    if (file.type.startsWith("image/")) {
      const pngInfo = await getPngMetadata(file);
      workflow = pngInfo?.workflow;
    } else if (
      file.type === "application/json" ||
      (file instanceof File && file.name.endsWith(".json"))
    ) {
      workflow = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsText(file);
      });
    }
    if (!workflow) {
      this.updateUi("⛔ No workflow found in dropped item.");
    } else {
      try {
        this.graph = JSON.parse(workflow);
      } catch (e) {
        this.graph = undefined;
      }
      if (!this.graph) {
        this.updateUi("⛔ Invalid workflow found in dropped item.");
      } else {
        this.loadGraphData(this.graph);
      }
    }
  }

  private async loadGraphData(graphData: SerializedGraph) {
    this.graphResults = await fixBadLinks(graphData);
    this.updateUi();
  }

  private async saveFixedWorkflow() {
    if (!this.graphFinalResults) {
      this.updateUi("⛔ Save w/o final graph patched.");
      return false;
    }

    let filename: string|null = (this.file as File).name || 'workflow.json';
    let filenames = filename.split('.');
    filenames.pop();
    filename = filenames.join('.');
    filename += '_fixed.json';
    filename = prompt("Save workflow as:", filename);
    if (!filename) return false;
    if (!filename.toLowerCase().endsWith(".json")) {
      filename += ".json";
    }
    const json = JSON.stringify(this.graphFinalResults.graph, null, 2);
    const blob = new Blob([json], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    await wait();
    anchor.click();
    await wait();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return true;
  }
}


function getNodeById(graph: SerializedGraph, id: number) {
  return graph.nodes.find((n) => n.id === id)!;
}

function extendLink(link: SerializedLink) {
  return {
    link: link,
    id: link[0],
    origin_id: link[1],
    origin_slot: link[2],
    target_id: link[3],
    target_slot: link[4],
    type: link[5],
  };
}

/**
 * Takes a SerializedGraph and inspects the links and nodes to ensure the linking makes logical
 * sense. Can apply fixes when passed the `fix` argument as true.
 *
 * Note that fixes are a best-effort attempt. Seems to get it correct in most cases, but there is a
 * chance it correct an anomoly that results in placing an incorrect link (say, if there were two
 * links in the data). Users should take care to not overwrite work until manually checking the
 * result.
 */
async function fixBadLinks(graph: SerializedGraph, fix = false): Promise<BadLinksData> {
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
  // const findBadLinksLogger = this.newLogSession("[findBadLinks]");
  const data: { patchedNodes: SerializedNode[]; deletedLinks: number[] } = {
    patchedNodes: [],
    deletedLinks: [],
  };

  /**
   * Internal patch node. We keep track of changes in patchedNodeSlots in case we're in a dry run.
   */
  async function patchNodeSlot(
    node: SerializedNode,
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
        await findBadLinksLogger.log(
          ` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"]![slot]!} Skipping.`,
        );
        return false;
      }
      let linkIdToSet = op === "REMOVE" ? null : linkId;
      patchedNode["inputs"]![slot] = linkIdToSet;
      if (fix) {
        // node.inputs[slot]!.link = linkIdToSet;
      }
    } else {
      patchedNode["outputs"] = patchedNode["outputs"] || {};
      patchedNode["outputs"]![slot] = patchedNode["outputs"]![slot] || {
        links: [...(node.outputs?.[slot]?.links || [])],
        changes: {},
      };
      if (patchedNode["outputs"]![slot]!["changes"]![linkId] !== undefined) {
        await findBadLinksLogger.log(
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
          await findBadLinksLogger.log(
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
          await findBadLinksLogger.log(
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
  function nodeHasLinkId(node: SerializedNode, ioDir: IoDirection, slot: number, linkId: number) {
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
  function nodeHasAnyLink(node: SerializedNode, ioDir: IoDirection, slot: number) {
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

  const linksReverse = [...graph.links];
  linksReverse.reverse();
  for (let l of linksReverse) {
    if (!l) continue;
    const link = extendLink(l);

    const originNode = getNodeById(graph, link.origin_id);
    const originHasLink = () =>
      nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id);
    const patchOrigin = (op: "ADD" | "REMOVE", id = link.id) =>
      patchNodeSlot(originNode, IoDirection.OUTPUT, link.origin_slot, id, op);

    const targetNode = getNodeById(graph, link.target_id);
    const targetHasLink = () =>
      nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id);
    const targetHasAnyLink = () => nodeHasAnyLink(targetNode, IoDirection.INPUT, link.target_slot);
    const patchTarget = (op: "ADD" | "REMOVE", id = link.id) =>
      patchNodeSlot(targetNode, IoDirection.INPUT, link.target_slot, id, op);

    const originLog = `origin(${link.origin_id}).outputs[${link.origin_slot}].links`;
    const targetLog = `target(${link.target_id}).inputs[${link.target_slot}].link`;

    if (!originNode || !targetNode) {
      if (!originNode && !targetNode) {
        await findBadLinksLogger.log(
          `Link ${link.id} is invalid, ` +
            `both origin ${link.origin_id} and target ${link.target_id} do not exist`,
        );
      } else if (!originNode) {
        await findBadLinksLogger.log(
          `Link ${link.id} is funky... ` +
            `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`,
        );
        if (targetHasLink()) {
          await findBadLinksLogger.log(
            ` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`,
          );
          patchTarget("REMOVE", -1);
        }
      } else if (!targetNode) {
        await findBadLinksLogger.log(
          `Link ${link.id} is funky... ` +
            `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`,
        );
        if (originHasLink()) {
          await findBadLinksLogger.log(
            ` > [PATCH] Origin's links' has ${link.id}; will remove the link first.`,
          );
          patchOrigin("REMOVE");
        }
      }
      continue;
    }

    if (targetHasLink() || originHasLink()) {
      if (!originHasLink()) {
        await findBadLinksLogger.log(
          `${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`,
        );
        await findBadLinksLogger.log(
          ` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`,
        );
        patchOrigin("ADD");
      } else if (!targetHasLink()) {
        await findBadLinksLogger.log(
          `${link.id} is funky... ${targetLog} is NOT correct (is ${
            targetNode.inputs[link.target_slot]!.link
          }), but ${originLog} contains it`,
        );
        if (!targetHasAnyLink()) {
          await findBadLinksLogger.log(
            ` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`,
          );
          let patched = patchTarget("ADD");
          if (!patched) {
            await findBadLinksLogger.log(
              ` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`,
            );
            patched = patchOrigin("REMOVE");
          }
        } else {
          await findBadLinksLogger.log(
            ` > [PATCH] ${targetLog} is defined, removing ${link.id} from ${originLog}.`,
          );
          patchOrigin("REMOVE");
        }
      }
    }
  }

  // Now that we've cleaned up the inputs, outputs, run through it looking for dangling links.,
  for (let l of linksReverse) {
    if (!l) continue;
    const link = extendLink(l);
    const originNode = getNodeById(graph, link.origin_id);
    const targetNode = getNodeById(graph, link.target_id);
    // Now that we've manipulated the linking, check again if they both exist.
    if (
      (!originNode || !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
      (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))
    ) {
      await findBadLinksLogger.log(
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
      await findBadLinksLogger.log(`Deleting link #${data.deletedLinks[i]}.`);
      // graph.links[data.deletedLinks[i]!];
      const idx = graph.links.findIndex((l) => l[0] === data.deletedLinks[i]);
      if (idx === -1) {
        await findBadLinksLogger.log(`INDEX NOT FOUND for #${data.deletedLinks[i]}`);
      }
      graph.links.splice(idx, 1);
    }
    graph.links = graph.links.filter((l) => !!l);
  }
  if (!data.patchedNodes.length && !data.deletedLinks.length) {
    await findBadLinksLogger.log(`No bad links detected.`);
    return {
      fixed: false,
      graph,
      patched: data.patchedNodes.length,
      deleted: data.deletedLinks.length,
    };
  }
  await findBadLinksLogger.log(
    `${fix ? "Made" : "Would make"} ${data.patchedNodes.length || "no"} node link patches, and ${
      data.deletedLinks.length || "no"
    } stale link removals.`,
  );
  return {
    fixed: fix,
    graph,
    patched: data.patchedNodes.length,
    deleted: data.deletedLinks.length,
  };
}
