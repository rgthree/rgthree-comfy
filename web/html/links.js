import { getPngMetadata } from "/scripts/pnginfo.js";
var IoDirection;
(function (IoDirection) {
    IoDirection[IoDirection["INPUT"] = 0] = "INPUT";
    IoDirection[IoDirection["OUTPUT"] = 1] = "OUTPUT";
})(IoDirection || (IoDirection = {}));
function wait(ms = 16, value) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, ms);
    });
}
const logger = {
    logTo: console,
    log: (...args) => {
        logger.logTo === console
            ? console.log(...args)
            : (logger.logTo.innerText += args.join(",") + "\n");
    },
};
const findBadLinksLogger = {
    log: async (...args) => {
        logger.log(...args);
    },
};
class LinkPage {
    constructor() {
        this.containerEl = document.querySelector(".box");
        this.figcaptionEl = document.querySelector("figcaption");
        this.outputeMessageEl = document.querySelector(".output");
        this.outputImageEl = document.querySelector(".output-image");
        this.btnFix = document.querySelector(".btn-fix");
        document.addEventListener("dragover", (e) => {
            e.preventDefault();
        }, false);
        document.addEventListener("drop", (e) => {
            this.onDrop(e);
        });
        this.btnFix.addEventListener("click", (e) => {
            this.onFixClick(e);
        });
    }
    async onFixClick(e) {
        if (!this.graphResults || !this.graph) {
            this.updateUi("⛔ Fix button click without results.");
            return;
        }
        let graphFinalResults = await fixBadLinks(this.graph, true);
        graphFinalResults = await fixBadLinks(graphFinalResults.graph, true);
        if (graphFinalResults.patched || graphFinalResults.deleted) {
            graphFinalResults = await fixBadLinks(graphFinalResults.graph, true);
        }
        if (graphFinalResults.patched || graphFinalResults.deleted) {
            this.updateUi("⛔ Hmm... Still detecting bad links. Can you file an issue at https://github.com/rgthree/rgthree-comfy/issues with your image/workflow.");
            return;
        }
        this.graphFinalResults = graphFinalResults;
        this.updateUi("✅ Workflow fixed.");
        this.saveFixedWorkflow();
    }
    async onDrop(event) {
        var _a, _b, _c, _d;
        if (!event.dataTransfer) {
            return;
        }
        this.reset();
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.files.length && ((_b = (_a = event.dataTransfer.files) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.type) !== "image/bmp") {
            await this.handleFile(event.dataTransfer.files[0]);
            return;
        }
        const validTypes = ["text/uri-list", "text/x-moz-url"];
        const match = [...event.dataTransfer.types].find((t) => validTypes.find((v) => t === v));
        if (match) {
            const uri = (_d = (_c = event.dataTransfer.getData(match)) === null || _c === void 0 ? void 0 : _c.split("\n")) === null || _d === void 0 ? void 0 : _d[0];
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
    updateUi(msg) {
        this.outputeMessageEl.innerHTML = "";
        if (this.file && !this.containerEl.classList.contains("-has-file")) {
            this.containerEl.classList.add("-has-file");
            this.figcaptionEl.innerHTML = this.file.name || this.file.type;
            if (this.file.type === "application/json") {
                this.outputImageEl.src = "icon_file_json.png";
            }
            else {
                const reader = new FileReader();
                reader.onload = () => (this.outputImageEl.src = reader.result);
                reader.readAsDataURL(this.file);
            }
        }
        else if (!this.file && this.containerEl.classList.contains("-has-file")) {
            this.containerEl.classList.remove("-has-file");
            this.outputImageEl.src = "";
            this.outputImageEl.removeAttribute("src");
        }
        if (this.graphResults) {
            this.containerEl.classList.add("-has-results");
            if (!this.graphResults.patched && !this.graphResults.deleted) {
                this.outputeMessageEl.innerHTML = "✅ No bad links detected in the workflow.";
            }
            else {
                this.outputeMessageEl.innerHTML = `⚠️ Found ${this.graphResults.patched} links to fix, and ${this.graphResults.deleted} to be removed.`;
            }
        }
        else {
            this.containerEl.classList.remove("-has-results");
        }
        if (msg) {
            this.outputeMessageEl.innerHTML = msg;
        }
    }
    async handleFile(file) {
        this.file = file;
        this.updateUi();
        let workflow = null;
        if (file.type.startsWith("image/")) {
            const pngInfo = await getPngMetadata(file);
            workflow = pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.workflow;
        }
        else if (file.type === "application/json" ||
            (file instanceof File && file.name.endsWith(".json"))) {
            workflow = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result);
                };
                reader.readAsText(file);
            });
        }
        if (!workflow) {
            this.updateUi("⛔ No workflow found in dropped item.");
        }
        else {
            try {
                this.graph = JSON.parse(workflow);
            }
            catch (e) {
                this.graph = undefined;
            }
            if (!this.graph) {
                this.updateUi("⛔ Invalid workflow found in dropped item.");
            }
            else {
                this.loadGraphData(this.graph);
            }
        }
    }
    async loadGraphData(graphData) {
        this.graphResults = await fixBadLinks(graphData);
        this.updateUi();
    }
    async saveFixedWorkflow() {
        if (!this.graphFinalResults) {
            this.updateUi("⛔ Save w/o final graph patched.");
            return;
        }
        let filename = this.file.name || 'workflow.json';
        let filenames = filename.split('.');
        filenames.pop();
        filename = filenames.join('.');
        filename += '_fixed.json';
        filename = prompt("Save workflow as:", filename);
        if (!filename)
            return;
        if (!filename.toLowerCase().endsWith(".json")) {
            filename += ".json";
        }
        const json = JSON.stringify(this.graphFinalResults.graph, null, 2);
        const blob = new Blob([json], { type: "application/json" });
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
    }
}
new LinkPage();
function getNodeById(graph, id) {
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
async function fixBadLinks(graph, fix = false) {
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
                await findBadLinksLogger.log(` > Already set ${node.id}.inputs[${slot}] to ${patchedNode["inputs"][slot]} Skipping.`);
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
                await findBadLinksLogger.log(` > Already set ${node.id}.outputs[${slot}] to ${patchedNode["inputs"][slot]}! Skipping.`);
                return false;
            }
            patchedNode["outputs"][slot]["changes"][linkId] = op;
            if (op === "ADD") {
                let linkIdIndex = patchedNode["outputs"][slot]["links"].indexOf(linkId);
                if (linkIdIndex !== -1) {
                    await findBadLinksLogger.log(` > Hmmm.. asked to add ${linkId} but it is already in list...`);
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
                    await findBadLinksLogger.log(` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`);
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
    const linksReverse = [...graph.links];
    linksReverse.reverse();
    for (let l of linksReverse) {
        if (!l)
            continue;
        const link = extendLink(l);
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
                await findBadLinksLogger.log(`Link ${link.id} is invalid, ` +
                    `both origin ${link.origin_id} and target ${link.target_id} do not exist`);
            }
            else if (!originNode) {
                await findBadLinksLogger.log(`Link ${link.id} is funky... ` +
                    `origin ${link.origin_id} does not exist, but target ${link.target_id} does.`);
                if (targetHasLink()) {
                    await findBadLinksLogger.log(` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`);
                    patchTarget("REMOVE", -1);
                }
            }
            else if (!targetNode) {
                await findBadLinksLogger.log(`Link ${link.id} is funky... ` +
                    `target ${link.target_id} does not exist, but origin ${link.origin_id} does.`);
                if (originHasLink()) {
                    await findBadLinksLogger.log(` > [PATCH] Origin's links' has ${link.id}; will remove the link first.`);
                    patchOrigin("REMOVE");
                }
            }
            continue;
        }
        if (targetHasLink() || originHasLink()) {
            if (!originHasLink()) {
                await findBadLinksLogger.log(`${link.id} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`);
                await findBadLinksLogger.log(` > [PATCH] Attempt a fix by adding this ${link.id} to ${originLog}.`);
                patchOrigin("ADD");
            }
            else if (!targetHasLink()) {
                await findBadLinksLogger.log(`${link.id} is funky... ${targetLog} is NOT correct (is ${targetNode.inputs[link.target_slot].link}), but ${originLog} contains it`);
                if (!targetHasAnyLink()) {
                    await findBadLinksLogger.log(` > [PATCH] ${targetLog} is not defined, will set to ${link.id}.`);
                    let patched = patchTarget("ADD");
                    if (!patched) {
                        await findBadLinksLogger.log(` > [PATCH] Nvm, ${targetLog} already patched. Removing ${link.id} from ${originLog}.`);
                        patched = patchOrigin("REMOVE");
                    }
                }
                else {
                    await findBadLinksLogger.log(` > [PATCH] ${targetLog} is defined, removing ${link.id} from ${originLog}.`);
                    patchOrigin("REMOVE");
                }
            }
        }
    }
    for (let l of linksReverse) {
        if (!l)
            continue;
        const link = extendLink(l);
        const originNode = getNodeById(graph, link.origin_id);
        const targetNode = getNodeById(graph, link.target_id);
        if ((!originNode || !nodeHasLinkId(originNode, IoDirection.OUTPUT, link.origin_slot, link.id)) &&
            (!targetNode || !nodeHasLinkId(targetNode, IoDirection.INPUT, link.target_slot, link.id))) {
            await findBadLinksLogger.log(`${link.id} is def invalid; BOTH origin node ${link.origin_id} ${originNode ? "is removed" : `doesn\'t have ${link.id}`} and ${link.origin_id} target node ${link.target_id ? "is removed" : `doesn\'t have ${link.id}`}.`);
            data.deletedLinks.push(link.id);
            continue;
        }
    }
    if (fix) {
        for (let i = data.deletedLinks.length - 1; i >= 0; i--) {
            await findBadLinksLogger.log(`Deleting link #${data.deletedLinks[i]}.`);
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
    await findBadLinksLogger.log(`${fix ? "Made" : "Would make"} ${data.patchedNodes.length || "no"} node link patches, and ${data.deletedLinks.length || "no"} stale link removals.`);
    return {
        fixed: fix,
        graph,
        patched: data.patchedNodes.length,
        deleted: data.deletedLinks.length,
    };
}
