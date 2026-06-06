import { RgthreeDialog } from "../../rgthree/common/dialog.js";
import { createElement as $el, empty, appendChildren, getClosestOrSelf, query, queryAll, setAttributes, } from "../../rgthree/common/utils_dom.js";
import { logoCivitai, link, pencilColored, diskColored, dotdotdot, } from "../../rgthree/common/media/svgs.js";
import { CHECKPOINT_INFO_SERVICE, LORA_INFO_SERVICE } from "../../rgthree/common/model_info_service.js";
import { rgthree } from "./rgthree.js";
import { MenuButton } from "../../rgthree/common/menu.js";
import { generateId, injectCss } from "../../rgthree/common/shared_utils.js";
class RgthreeInfoDialog extends RgthreeDialog {
    constructor(file) {
        const dialogOptions = {
            class: "rgthree-info-dialog",
            title: `<h2>Loading...</h2>`,
            content: "<center>Loading..</center>",
        };
        super(dialogOptions);
        this.modifiedModelData = false;
        this.modelInfo = null;
        this.pendingModelDataSaves = new Set();
        this.options.onBeforeClose = () => this.waitForPendingModelDataSaves();
        this.init(file);
    }
    async init(file) {
        var _a, _b;
        const cssPromise = injectCss("rgthree/common/css/dialog_model_info.css");
        this.modelInfo = await this.getModelInfo(file);
        await cssPromise;
        this.setContent(this.getInfoContent());
        this.setTitle(((_a = this.modelInfo) === null || _a === void 0 ? void 0 : _a["name"]) || ((_b = this.modelInfo) === null || _b === void 0 ? void 0 : _b["file"]) || "Unknown");
        this.attachEvents();
    }
    getCloseEventDetail() {
        const detail = {
            dirty: this.modifiedModelData,
        };
        return { detail };
    }
    showDisplayNameField() {
        return false;
    }
    async waitForPendingModelDataSaves() {
        await Promise.all([...this.pendingModelDataSaves].map((promise) => promise.catch(() => null)));
        return true;
    }
    async savePartialModelInfoWithPending(file, data) {
        const promise = this.savePartialModelInfo(file, data);
        this.pendingModelDataSaves.add(promise);
        try {
            const info = await promise;
            if (info) {
                this.modelInfo = info;
            }
            return info;
        }
        finally {
            this.pendingModelDataSaves.delete(promise);
        }
    }
    attachEvents() {
        this.contentElement.addEventListener("click", async (e) => {
            const target = getClosestOrSelf(e.target, "[data-action]");
            const action = target === null || target === void 0 ? void 0 : target.getAttribute("data-action");
            if (!target || !action) {
                return;
            }
            await this.handleEventAction(action, target, e);
        });
    }
    async handleEventAction(action, target, e) {
        var _a, _b;
        const info = this.modelInfo;
        if (!(info === null || info === void 0 ? void 0 : info.file)) {
            return;
        }
        if (action === "fetch-civitai") {
            this.modelInfo = await this.refreshModelInfo(info.file);
            this.setContent(this.getInfoContent());
            this.setTitle(((_a = this.modelInfo) === null || _a === void 0 ? void 0 : _a["name"]) || ((_b = this.modelInfo) === null || _b === void 0 ? void 0 : _b["file"]) || "Unknown");
        }
        else if (action === "copy-trained-words") {
            const selected = queryAll(".-rgthree-is-selected", target.closest("tr"));
            const text = selected.map((el) => el.getAttribute("data-word")).join(", ");
            await navigator.clipboard.writeText(text);
            rgthree.showMessage({
                id: "copy-trained-words-" + generateId(4),
                type: "success",
                message: `Successfully copied ${selected.length} key word${selected.length === 1 ? "" : "s"}.`,
                timeout: 4000,
            });
        }
        else if (action === "toggle-trained-word") {
            target === null || target === void 0 ? void 0 : target.classList.toggle("-rgthree-is-selected");
            const tr = target.closest("tr");
            if (tr) {
                const span = query("td:first-child > *", tr);
                let small = query("small", span);
                if (!small) {
                    small = $el("small", { parent: span });
                }
                const num = queryAll(".-rgthree-is-selected", tr).length;
                small.innerHTML = num
                    ? `${num} selected | <span role="button" data-action="copy-trained-words">Copy</span>`
                    : "";
            }
        }
        else if (action === "edit-row") {
            const tr = target.closest("tr");
            const td = query("td:nth-child(2)", tr);
            const input = td.querySelector("input,textarea");
            if (!input) {
                const fieldName = tr.dataset["fieldName"];
                tr.classList.add("-rgthree-editing");
                const isTextarea = fieldName === "userNote";
                const input = $el(`${isTextarea ? "textarea" : 'input[type="text"]'}`, {
                    value: td.textContent,
                });
                input.addEventListener("keydown", async (e) => {
                    if (!isTextarea && e.key === "Enter") {
                        e.stopPropagation();
                        e.preventDefault();
                        const modified = await saveEditableRow(info, tr, true, this.savePartialModelInfoWithPending.bind(this));
                        this.modifiedModelData = this.modifiedModelData || modified;
                    }
                    else if (e.key === "Escape") {
                        e.stopPropagation();
                        e.preventDefault();
                        const modified = await saveEditableRow(info, tr, false, this.savePartialModelInfoWithPending.bind(this));
                        this.modifiedModelData = this.modifiedModelData || modified;
                    }
                });
                appendChildren(empty(td), [input]);
                input.focus();
            }
            else if (target.nodeName.toLowerCase() === "button") {
                const modified = await saveEditableRow(info, tr, true, this.savePartialModelInfoWithPending.bind(this));
                this.modifiedModelData = this.modifiedModelData || modified;
            }
            e === null || e === void 0 ? void 0 : e.preventDefault();
            e === null || e === void 0 ? void 0 : e.stopPropagation();
        }
    }
    getInfoContent() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        const info = this.modelInfo || {};
        const civitaiLink = (_a = info.links) === null || _a === void 0 ? void 0 : _a.find((i) => i.includes("civitai.com/models"));
        const html = `
      <ul class="rgthree-info-area">
        <li title="Type" class="rgthree-info-tag -type -type-${(info.type || "").toLowerCase()}"><span>${info.type || ""}</span></li>
        <li title="Base Model" class="rgthree-info-tag -basemodel -basemodel-${(info.baseModel || "").toLowerCase()}"><span>${info.baseModel || ""}</span></li>
        <li class="rgthree-info-menu" stub="menu"></li>
        ${""}
      </ul>

      <table class="rgthree-info-table">
        ${infoTableRow("File", info.file || "")}
        ${infoTableRow("Hash (sha256)", info.sha256 || "")}
        ${civitaiLink
            ? infoTableRow("Civitai", `<a href="${civitaiLink}" target="_blank">${logoCivitai}View on Civitai</a>`)
            : ((_c = (_b = info.raw) === null || _b === void 0 ? void 0 : _b.civitai) === null || _c === void 0 ? void 0 : _c.error) === "Model not found"
                ? infoTableRow("Civitai", '<i>Model not found</i> <span class="-help" title="The model was not found on civitai with the sha256 hash. It\'s possible the model was removed, re-uploaded, or was never on civitai to begin with."></span>')
                : ((_e = (_d = info.raw) === null || _d === void 0 ? void 0 : _d.civitai) === null || _e === void 0 ? void 0 : _e.error)
                    ? infoTableRow("Civitai", (_g = (_f = info.raw) === null || _f === void 0 ? void 0 : _f.civitai) === null || _g === void 0 ? void 0 : _g.error)
                    : !((_h = info.raw) === null || _h === void 0 ? void 0 : _h.civitai)
                        ? infoTableRow("Civitai", `<button class="rgthree-button" data-action="fetch-civitai">Fetch info from civitai</button>`)
                        : ""}

        ${infoTableRow("Name", info.name || ((_k = (_j = info.raw) === null || _j === void 0 ? void 0 : _j.metadata) === null || _k === void 0 ? void 0 : _k.ss_output_name) || "", "The name for display.", "name")}
        ${this.showDisplayNameField()
            ? infoTableRow("Display Name", (_l = info.displayName) !== null && _l !== void 0 ? _l : "", "The optional name shown in the Power Lora Loader instead of the file name.", "displayName")
            : ""}

        ${!info.baseModelFile && !info.baseModelFile
            ? ""
            : infoTableRow("Base Model", (info.baseModel || "") + (info.baseModelFile ? ` (${info.baseModelFile})` : ""))}


        ${!((_m = info.trainedWords) === null || _m === void 0 ? void 0 : _m.length)
            ? ""
            : infoTableRow("Trained Words", (_o = getTrainedWordsMarkup(info.trainedWords)) !== null && _o !== void 0 ? _o : "", "Trained words from the metadata and/or civitai. Click to select for copy.")}

        ${!((_q = (_p = info.raw) === null || _p === void 0 ? void 0 : _p.metadata) === null || _q === void 0 ? void 0 : _q.ss_clip_skip) || ((_t = (_s = info.raw) === null || _s === void 0 ? void 0 : _s.metadata) === null || _t === void 0 ? void 0 : _t.ss_clip_skip) == "None"
            ? ""
            : infoTableRow("Clip Skip", (_v = (_u = info.raw) === null || _u === void 0 ? void 0 : _u.metadata) === null || _v === void 0 ? void 0 : _v.ss_clip_skip)}
        ${infoTableRow("Strength Min", (_w = info.strengthMin) !== null && _w !== void 0 ? _w : "", "The recommended minimum strength, In the Power Lora Loader node, strength will signal when it is below this threshold.", "strengthMin")}
        ${infoTableRow("Strength Max", (_x = info.strengthMax) !== null && _x !== void 0 ? _x : "", "The recommended maximum strength. In the Power Lora Loader node, strength will signal when it is above this threshold.", "strengthMax")}
        ${""}
        ${infoTableRow("Additional Notes", (_y = info.userNote) !== null && _y !== void 0 ? _y : "", "Additional notes you'd like to keep and reference in the info dialog.", "userNote")}

      </table>

      <ul class="rgthree-info-images">${(_0 = (_z = info.images) === null || _z === void 0 ? void 0 : _z.map((img) => `
        <li>
          <figure>${img.type === 'video'
            ? `<video src="${img.url}" autoplay loop></video>`
            : `<img src="${img.url}" />`}
            <figcaption><!--
              -->${imgInfoField("", img.civitaiUrl
            ? `<a href="${img.civitaiUrl}" target="_blank">civitai${link}</a>`
            : undefined)}<!--
              -->${imgInfoField("seed", img.seed)}<!--
              -->${imgInfoField("steps", img.steps)}<!--
              -->${imgInfoField("cfg", img.cfg)}<!--
              -->${imgInfoField("sampler", img.sampler)}<!--
              -->${imgInfoField("model", img.model)}<!--
              -->${imgInfoField("positive", img.positive)}<!--
              -->${imgInfoField("negative", img.negative)}<!--
            --><!--${""}--></figcaption>
          </figure>
        </li>`).join("")) !== null && _0 !== void 0 ? _0 : ""}</ul>
    `;
        const div = $el("div", { html });
        if (rgthree.isDevMode()) {
            setAttributes(query('[stub="menu"]', div), {
                children: [
                    new MenuButton({
                        icon: dotdotdot,
                        options: [
                            { label: "More Actions", type: "title" },
                            {
                                label: "Open API JSON",
                                callback: async (e) => {
                                    var _a;
                                    if ((_a = this.modelInfo) === null || _a === void 0 ? void 0 : _a.file) {
                                        window.open(`rgthree/api/loras/info?file=${encodeURIComponent(this.modelInfo.file)}`);
                                    }
                                },
                            },
                            {
                                label: "Clear all local info",
                                callback: async (e) => {
                                    var _a, _b, _c;
                                    if ((_a = this.modelInfo) === null || _a === void 0 ? void 0 : _a.file) {
                                        this.modelInfo = await LORA_INFO_SERVICE.clearFetchedInfo(this.modelInfo.file);
                                        this.setContent(this.getInfoContent());
                                        this.setTitle(((_b = this.modelInfo) === null || _b === void 0 ? void 0 : _b["name"]) || ((_c = this.modelInfo) === null || _c === void 0 ? void 0 : _c["file"]) || "Unknown");
                                    }
                                },
                            },
                        ],
                    }),
                ],
            });
        }
        return div;
    }
}
export class RgthreeLoraInfoDialog extends RgthreeInfoDialog {
    showDisplayNameField() {
        return true;
    }
    async getModelInfo(file) {
        return LORA_INFO_SERVICE.getInfo(file, false, false);
    }
    async refreshModelInfo(file) {
        return LORA_INFO_SERVICE.refreshInfo(file);
    }
    async clearModelInfo(file) {
        return LORA_INFO_SERVICE.clearFetchedInfo(file);
    }
    async savePartialModelInfo(file, data) {
        return LORA_INFO_SERVICE.savePartialInfo(file, data);
    }
}
export class RgthreeCheckpointInfoDialog extends RgthreeInfoDialog {
    async getModelInfo(file) {
        return CHECKPOINT_INFO_SERVICE.getInfo(file, false, false);
    }
    async refreshModelInfo(file) {
        return CHECKPOINT_INFO_SERVICE.refreshInfo(file);
    }
    async clearModelInfo(file) {
        return CHECKPOINT_INFO_SERVICE.clearFetchedInfo(file);
    }
    async savePartialModelInfo(file, data) {
        return CHECKPOINT_INFO_SERVICE.savePartialInfo(file, data);
    }
}
function infoTableRow(name, value, help = "", editableFieldName = "") {
    return `
    <tr class="${editableFieldName ? "editable" : ""}" ${editableFieldName ? `data-field-name="${editableFieldName}"` : ""}>
      <td><span>${name} ${help ? `<span class="-help" title="${help}"></span>` : ""}<span></td>
      <td ${editableFieldName ? "" : 'colspan="2"'}>${String(value).startsWith("<") ? value : `<span>${value}<span>`}</td>
      ${editableFieldName
        ? `<td style="width: 24px;"><button class="rgthree-button-reset rgthree-button-edit" data-action="edit-row">${pencilColored}${diskColored}</button></td>`
        : ""}
    </tr>`;
}
function getTrainedWordsMarkup(words) {
    let markup = `<ul class="rgthree-info-trained-words-list">`;
    for (const wordData of words || []) {
        markup += `<li title="${wordData.word}" data-word="${wordData.word}" class="rgthree-info-trained-words-list-item" data-action="toggle-trained-word">
      <span>${wordData.word}</span>
      ${wordData.civitai ? logoCivitai : ""}
      ${wordData.count != null ? `<small>${wordData.count}</small>` : ""}
    </li>`;
    }
    markup += `</ul>`;
    return markup;
}
async function saveEditableRow(info, tr, saving = true, savePartialInfo) {
    var _a;
    const fieldName = tr.dataset["fieldName"];
    const input = query("input,textarea", tr);
    let newValue = String((_a = info[fieldName]) !== null && _a !== void 0 ? _a : "");
    let modified = false;
    if (saving) {
        newValue = fieldName === "displayName" ? input.value.trim() : input.value;
        if (fieldName.startsWith("strength")) {
            if (Number.isNaN(Number(newValue))) {
                alert(`You must enter a number into the ${fieldName} field.`);
                return false;
            }
            newValue = (Math.round(Number(newValue) * 100) / 100).toFixed(2);
        }
        try {
            await savePartialInfo(info.file, { [fieldName]: newValue });
        }
        catch (e) {
            console.error("[rgthree] Failed to save model info.", e);
            return false;
        }
        modified = true;
    }
    tr.classList.remove("-rgthree-editing");
    const td = query("td:nth-child(2)", tr);
    appendChildren(empty(td), [$el("span", { text: newValue })]);
    return modified;
}
function imgInfoField(label, value) {
    return value != null ? `<span>${label ? `<label>${label} </label>` : ""}${value}</span>` : "";
}
