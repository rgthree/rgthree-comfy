import type { BadLinksData, SerializedGraph, SerializedLink, SerializedNode } from "typings/index.js";
import type { LGraph, LGraphNode, LLink, serializedLGraph } from "typings/litegraph.js";

enum IoDirection {
  INPUT,
  OUTPUT,
}

function getNodeById(graph: SerializedGraph | LGraph | serializedLGraph, id: number) {
  if ((graph as LGraph).getNodeById) {
    return (graph as LGraph).getNodeById(id);
  }
  graph = graph as SerializedGraph;
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
 * Takes a SerializedGraph or live LGraph and inspects the links and nodes to ensure the linking
 * makes logical sense. Can apply fixes when passed the `fix` argument as true.
 *
 * Note that fixes are a best-effort attempt. Seems to get it correct in most cases, but there is a
 * chance it correct an anomoly that results in placing an incorrect link (say, if there were two
 * links in the data). Users should take care to not overwrite work until manually checking the
 * result.
 */
export function fixBadLinks(
  graph: SerializedGraph | LGraph,
  fix = false,
  silent = false,
  logger: { log: (...args: any[]) => void } = console,
): BadLinksData {
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
  // const logger = this.newLogSession("[findBadLinks]");
  const data: { patchedNodes: Array<SerializedNode | LGraphNode>; deletedLinks: number[] } = {
    patchedNodes: [],
    deletedLinks: [],
  };

  /**
   * Internal patch node. We keep track of changes in patchedNodeSlots in case we're in a dry run.
   */
  async function patchNodeSlot(
    node: SerializedNode | LGraphNode,
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
        !silent &&
          logger.log(
            ` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"]![
              slot
            ]!} Skipping.`,
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
        !silent &&
          logger.log(
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
          !silent && logger.log(` > Hmmm.. asked to add ${linkId} but it is already in list...`);
          return false;
        }
        patchedNode["outputs"]![slot]!["links"].push(linkId);
        if (fix) {
          node.outputs = node.outputs || [];
          node.outputs[slot] = node.outputs[slot] || ({} as any);
          node.outputs[slot]!.links = node.outputs[slot]!.links || [];
          node.outputs[slot]!.links!.push(linkId);
        }
      } else {
        let linkIdIndex = patchedNode["outputs"]![slot]!["links"].indexOf(linkId);
        if (linkIdIndex === -1) {
          !silent && logger.log(` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`);
          return false;
        }
        patchedNode["outputs"]![slot]!["links"].splice(linkIdIndex, 1);
        if (fix) {
          node.outputs?.[slot]!.links!.splice(linkIdIndex, 1);
        }
      }
    }
    data.patchedNodes.push(node);
    return true;
  }

  /**
   * Internal to check if a node (or patched data) has a linkId.
   */
  function nodeHasLinkId(
    node: SerializedNode | LGraphNode,
    ioDir: IoDirection,
    slot: number,
    linkId: number,
  ) {
    // Patched data should be canonical. We can double check if fixing too.
    let has = false;
    if (ioDir === IoDirection.INPUT) {
      let nodeHasIt = node.inputs?.[slot]?.link === linkId;
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
      let nodeHasIt = node.outputs?.[slot]?.links?.includes(linkId);
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
  function nodeHasAnyLink(node: SerializedNode | LGraphNode, ioDir: IoDirection, slot: number) {
    // Patched data should be canonical. We can double check if fixing too.
    let hasAny = false;
    if (ioDir === IoDirection.INPUT) {
      let nodeHasAny = node.inputs?.[slot]?.link != null;
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
      let nodeHasAny = node.outputs?.[slot]?.links?.length;
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

  let links: Array<SerializedLink | LLink> = [];
  if (!Array.isArray(graph.links)) {
    Object.values(graph.links).reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, links);
  } else {
    links = graph.links;
  }

  const linksReverse = [...links];
  linksReverse.reverse();
  for (let l of linksReverse) {
    if (!l) continue;
    const link = (l as LLink).origin_slot != null ? (l as LLink) : extendLink(l as SerializedLink);

    const originNode = getNodeById(graph, link.origin_id);
    const originHasLink = () =>
      nodeHasLinkId(originNode!, IoDirection.OUTPUT, link.origin_slot, link.id);
    const patchOrigin = (op: "ADD" | "REMOVE", id = link.id) =>
      patchNodeSlot(originNode!, IoDirection.OUTPUT, link.origin_slot, id, op);

    const targetNode = getNodeById(graph, link.target_id);
    const targetHasLink = () =>
      nodeHasLinkId(targetNode!, IoDirection.INPUT, link.target_slot, link.id);
    const targetHasAnyLink = () => nodeHasAnyLink(targetNode!, IoDirection.INPUT, link.target_slot);
    const patchTarget = (op: "ADD" | "REMOVE", id = link.id) =>
      patchNodeSlot(targetNode!, IoDirection.INPUT, link.target_slot, id, op);

    const originLog = `origin(${link.origin_id}).outputs[${link.origin_slot}].links`;
    const targetLog = `target(${link.target_id}).inputs[${link.target_slot}].link`;

    if (!originNode || !targetNode) {
      if (!originNode && !targetNode) {
        !silent &&
          logger.log(
            `Link ${link.id} is invalid, ` +
              `both origin ${link.origin_id} and target ${link.target_id} do not exist`,
          );
      } else if (!originNode) {
        !silent &&
          logger.log(
            `Link ${link.id} is funky... ` +
              `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`,
          );
        if (targetHasLink()) {
          !silent &&
            logger.log(
              ` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`,
            );
          patchTarget("REMOVE", -1);
        }
      } else if (!targetNode) {
        !silent &&
          logger.log(
            `Link ${link.id} is funky... ` +
              `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`,
          );
        if (originHasLink()) {
          !silent &&
            logger.log(` > [PATCH] Origin's links' has ${link.id}; will remove the link first.`);
          patchOrigin("REMOVE");
        }
      }
      continue;
    }

    if (targetHasLink() || originHasLink()) {
      if (!originHasLink()) {
        !silent &&
          logger.log(
            `${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`,
          );
        !silent &&
          logger.log(` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`);
        patchOrigin("ADD");
      } else if (!targetHasLink()) {
        !silent &&
          logger.log(
            `${link.id} is funky... ${targetLog} is NOT correct (is ${targetNode.inputs?.[
              link.target_slot
            ]?.link}), but ${originLog} contains it`,
          );
        if (!targetHasAnyLink()) {
          !silent && logger.log(` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`);
          let patched = patchTarget("ADD");
          if (!patched) {
            !silent &&
              logger.log(
                ` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`,
              );
            patched = patchOrigin("REMOVE");
          }
        } else {
          !silent &&
            logger.log(
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
    const link = (l as LLink).origin_slot != null ? (l as LLink) : extendLink(l as SerializedLink);
    const originNode = getNodeById(graph, link.origin_id);
    const targetNode = getNodeById(graph, link.target_id);
    // Now that we've manipulated the linking, check again if they both exist.
    if (
      (!originNode || !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
      (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))
    ) {
      !silent &&
        logger.log(
          `${link.id} is def invalid; BOTH origin node ${link.origin_id} ${
            !originNode ? "is removed" : `doesn\'t have ${link.id}`
          } and ${link.origin_id} target node ${
            !targetNode ? "is removed" : `doesn\'t have ${link.id}`
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
      !silent && logger.log(`Deleting link #${data.deletedLinks[i]}.`);
      if ((graph as LGraph).getNodeById) {
        delete graph.links[data.deletedLinks[i]!];
      } else {
        graph = graph as SerializedGraph;
        // Sometimes we got objects for links if passed after ComfyUI's loadGraphData modifies the
        // data. We make a copy now, but can handle the bastardized objects just in case.
        const idx = graph.links.findIndex(
          (l) => l && (l[0] === data.deletedLinks[i] || (l as any).id === data.deletedLinks[i]),
        );
        if (idx === -1) {
          logger.log(`INDEX NOT FOUND for #${data.deletedLinks[i]}`);
        }
        logger.log(`splicing ${idx} from links`);
        graph.links.splice(idx, 1);
      }
    }
    // If we're a serialized graph, we can filter out the links because it's just an array.
    if (!(graph as LGraph).getNodeById) {
      graph.links = (graph as SerializedGraph).links.filter((l) => !!l);
    }
  }
  if (!data.patchedNodes.length && !data.deletedLinks.length) {
    return {
      hasBadLinks: false,
      fixed: false,
      graph,
      patched: data.patchedNodes.length,
      deleted: data.deletedLinks.length,
    };
  }
  !silent &&
    logger.log(
      `${fix ? "Made" : "Would make"} ${data.patchedNodes.length || "no"} node link patches, and ${
        data.deletedLinks.length || "no"
      } stale link removals.`,
    );

  let hasBadLinks: boolean = !!(data.patchedNodes.length || data.deletedLinks.length);
  // If we're fixing, then let's run it again to see if there are no more bad links.
  if (fix && !silent) {
    const rerun = fixBadLinks(graph, false, true);
    hasBadLinks = rerun.hasBadLinks;
  }

  return {
    hasBadLinks,
    fixed: !!hasBadLinks && fix,
    graph,
    patched: data.patchedNodes.length,
    deleted: data.deletedLinks.length,
  };
}
