var IoDirection;
(function (IoDirection) {
    IoDirection[IoDirection["INPUT"] = 0] = "INPUT";
    IoDirection[IoDirection["OUTPUT"] = 1] = "OUTPUT";
})(IoDirection || (IoDirection = {}));
function getNodeById(graph, id) {
    if (graph.getNodeById) {
        return graph.getNodeById(id);
    }
    graph = graph;
    return graph.nodes.find((n) => n.id === id);
}
function extendLink(link) {
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
export function fixBadLinks(graph, fix = false, silent = false, logger = console) {
    var _a, _b;
    const patchedNodeSlots = {};
    const data = {
        patchedNodes: [],
        deletedLinks: [],
    };
    async function patchNodeSlot(node, ioDir, slot, linkId, op) {
        var _a, _b, _c;
        patchedNodeSlots[node.id] = patchedNodeSlots[node.id] || {};
        const patchedNode = patchedNodeSlots[node.id];
        if (ioDir == IoDirection.INPUT) {
            patchedNode["inputs"] = patchedNode["inputs"] || {};
            if (patchedNode["inputs"][slot] !== undefined) {
                !silent &&
                    logger.log(` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"][slot]} Skipping.`);
                return false;
            }
            let linkIdToSet = op === "REMOVE" ? null : linkId;
            patchedNode["inputs"][slot] = linkIdToSet;
            if (fix) {
            }
        }
        else {
            patchedNode["outputs"] = patchedNode["outputs"] || {};
            patchedNode["outputs"][slot] = patchedNode["outputs"][slot] || {
                links: [...(((_b = (_a = node.outputs) === null || _a === void 0 ? void 0 : _a[slot]) === null || _b === void 0 ? void 0 : _b.links) || [])],
                changes: {},
            };
            if (patchedNode["outputs"][slot]["changes"][linkId] !== undefined) {
                !silent &&
                    logger.log(` > Already set ${node.id}.outputs[${slot}] to ${patchedNode["inputs"][slot]}! Skipping.`);
                return false;
            }
            patchedNode["outputs"][slot]["changes"][linkId] = op;
            if (op === "ADD") {
                let linkIdIndex = patchedNode["outputs"][slot]["links"].indexOf(linkId);
                if (linkIdIndex !== -1) {
                    !silent && logger.log(` > Hmmm.. asked to add ${linkId} but it is already in list...`);
                    return false;
                }
                patchedNode["outputs"][slot]["links"].push(linkId);
                if (fix) {
                    node.outputs = node.outputs || [];
                    node.outputs[slot] = node.outputs[slot] || {};
                    node.outputs[slot].links = node.outputs[slot].links || [];
                    node.outputs[slot].links.push(linkId);
                }
            }
            else {
                let linkIdIndex = patchedNode["outputs"][slot]["links"].indexOf(linkId);
                if (linkIdIndex === -1) {
                    !silent && logger.log(` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`);
                    return false;
                }
                patchedNode["outputs"][slot]["links"].splice(linkIdIndex, 1);
                if (fix) {
                    (_c = node.outputs) === null || _c === void 0 ? void 0 : _c[slot].links.splice(linkIdIndex, 1);
                }
            }
        }
        data.patchedNodes.push(node);
        return true;
    }
    function nodeHasLinkId(node, ioDir, slot, linkId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        let has = false;
        if (ioDir === IoDirection.INPUT) {
            let nodeHasIt = ((_b = (_a = node.inputs) === null || _a === void 0 ? void 0 : _a[slot]) === null || _b === void 0 ? void 0 : _b.link) === linkId;
            if ((_c = patchedNodeSlots[node.id]) === null || _c === void 0 ? void 0 : _c["inputs"]) {
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
            let nodeHasIt = (_f = (_e = (_d = node.outputs) === null || _d === void 0 ? void 0 : _d[slot]) === null || _e === void 0 ? void 0 : _e.links) === null || _f === void 0 ? void 0 : _f.includes(linkId);
            if ((_j = (_h = (_g = patchedNodeSlots[node.id]) === null || _g === void 0 ? void 0 : _g["outputs"]) === null || _h === void 0 ? void 0 : _h[slot]) === null || _j === void 0 ? void 0 : _j["changes"][linkId]) {
                let patchedHasIt = (_k = patchedNodeSlots[node.id]["outputs"][slot]) === null || _k === void 0 ? void 0 : _k.links.includes(linkId);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        let hasAny = false;
        if (ioDir === IoDirection.INPUT) {
            let nodeHasAny = ((_b = (_a = node.inputs) === null || _a === void 0 ? void 0 : _a[slot]) === null || _b === void 0 ? void 0 : _b.link) != null;
            if ((_c = patchedNodeSlots[node.id]) === null || _c === void 0 ? void 0 : _c["inputs"]) {
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
            let nodeHasAny = (_f = (_e = (_d = node.outputs) === null || _d === void 0 ? void 0 : _d[slot]) === null || _e === void 0 ? void 0 : _e.links) === null || _f === void 0 ? void 0 : _f.length;
            if ((_j = (_h = (_g = patchedNodeSlots[node.id]) === null || _g === void 0 ? void 0 : _g["outputs"]) === null || _h === void 0 ? void 0 : _h[slot]) === null || _j === void 0 ? void 0 : _j["changes"]) {
                let patchedHasAny = (_k = patchedNodeSlots[node.id]["outputs"][slot]) === null || _k === void 0 ? void 0 : _k.links.length;
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
    let links = [];
    if (!Array.isArray(graph.links)) {
        Object.values(graph.links).reduce((acc, v) => {
            acc[v.id] = v;
            return acc;
        }, links);
    }
    else {
        links = graph.links;
    }
    const linksReverse = [...links];
    linksReverse.reverse();
    for (let l of linksReverse) {
        if (!l)
            continue;
        const link = l.origin_slot != null ? l : extendLink(l);
        const originNode = getNodeById(graph, link.origin_id);
        const originHasLink = () => nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id);
        const patchOrigin = (op, id = link.id) => patchNodeSlot(originNode, IoDirection.OUTPUT, link.origin_slot, id, op);
        const targetNode = getNodeById(graph, link.target_id);
        const targetHasLink = () => nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id);
        const targetHasAnyLink = () => nodeHasAnyLink(targetNode, IoDirection.INPUT, link.target_slot);
        const patchTarget = (op, id = link.id) => patchNodeSlot(targetNode, IoDirection.INPUT, link.target_slot, id, op);
        const originLog = `origin(${link.origin_id}).outputs[${link.origin_slot}].links`;
        const targetLog = `target(${link.target_id}).inputs[${link.target_slot}].link`;
        if (!originNode || !targetNode) {
            if (!originNode && !targetNode) {
                !silent &&
                    logger.log(`Link ${link.id} is invalid, ` +
                        `both origin ${link.origin_id} and target ${link.target_id} do not exist`);
            }
            else if (!originNode) {
                !silent &&
                    logger.log(`Link ${link.id} is funky... ` +
                        `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`);
                if (targetHasLink()) {
                    !silent &&
                        logger.log(` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`);
                    patchTarget("REMOVE", -1);
                }
            }
            else if (!targetNode) {
                !silent &&
                    logger.log(`Link ${link.id} is funky... ` +
                        `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`);
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
                    logger.log(`${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`);
                !silent &&
                    logger.log(` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`);
                patchOrigin("ADD");
            }
            else if (!targetHasLink()) {
                !silent &&
                    logger.log(`${link.id} is funky... ${targetLog} is NOT correct (is ${(_b = (_a = targetNode.inputs) === null || _a === void 0 ? void 0 : _a[link.target_slot]) === null || _b === void 0 ? void 0 : _b.link}), but ${originLog} contains it`);
                if (!targetHasAnyLink()) {
                    !silent && logger.log(` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`);
                    let patched = patchTarget("ADD");
                    if (!patched) {
                        !silent &&
                            logger.log(` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`);
                        patched = patchOrigin("REMOVE");
                    }
                }
                else {
                    !silent &&
                        logger.log(` > [PATCH] ${targetLog} is defined, removing ${link.id} from ${originLog}.`);
                    patchOrigin("REMOVE");
                }
            }
        }
    }
    for (let l of linksReverse) {
        if (!l)
            continue;
        const link = l.origin_slot != null ? l : extendLink(l);
        const originNode = getNodeById(graph, link.origin_id);
        const targetNode = getNodeById(graph, link.target_id);
        if ((!originNode || !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
            (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))) {
            !silent &&
                logger.log(`${link.id} is def invalid; BOTH origin node ${link.origin_id} ${!originNode ? "is removed" : `doesn\'t have ${link.id}`} and ${link.origin_id} target node ${!targetNode ? "is removed" : `doesn\'t have ${link.id}`}.`);
            data.deletedLinks.push(link.id);
            continue;
        }
    }
    if (fix) {
        for (let i = data.deletedLinks.length - 1; i >= 0; i--) {
            !silent && logger.log(`Deleting link #${data.deletedLinks[i]}.`);
            if (graph.getNodeById) {
                delete graph.links[data.deletedLinks[i]];
            }
            else {
                graph = graph;
                const idx = graph.links.findIndex((l) => l && (l[0] === data.deletedLinks[i] || l.id === data.deletedLinks[i]));
                if (idx === -1) {
                    logger.log(`INDEX NOT FOUND for #${data.deletedLinks[i]}`);
                }
                logger.log(`splicing ${idx} from links`);
                graph.links.splice(idx, 1);
            }
        }
        if (!graph.getNodeById) {
            graph.links = graph.links.filter((l) => !!l);
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
        logger.log(`${fix ? "Made" : "Would make"} ${data.patchedNodes.length || "no"} node link patches, and ${data.deletedLinks.length || "no"} stale link removals.`);
    let hasBadLinks = !!(data.patchedNodes.length || data.deletedLinks.length);
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
