import { RgthreeDialog } from "../../rgthree/common/dialog.js";
import { createElement as $el, empty, appendChildren, getClosestOrSelf, queryOne, } from "../../rgthree/common/utils_dom.js";
import { logoCivitai, link, pencilColored, diskColored, } from "../../rgthree/common/media/svgs.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { SERVICE as MODEL_INFO_SERVICE } from "../../rgthree/common/model_info_service.js";
export class RgthreeInfoDialog extends RgthreeDialog {
    constructor(file) {
        const dialogOptions = {
            class: "rgthree-info-dialog",
            title: `<h2>Loading...</h2>`,
            content: "<center>Loading..</center>",
            onBeforeClose: () => {
                return true;
            },
            buttons: [
                {
                    label: "Done",
                    className: "rgthree-button -blue",
                    callback: async (e) => { },
                },
            ],
        };
        super(dialogOptions);
        this.modifiedModelData = false;
        this.modelInfo = null;
        this.init(file);
    }
    async init(file) {
        var _a, _b;
        this.modelInfo = await MODEL_INFO_SERVICE.getLora(file);
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
    attachEvents() {
        this.contentElement.addEventListener("click", async (e) => {
            const info = this.modelInfo;
            if (!(info === null || info === void 0 ? void 0 : info.file)) {
                return;
            }
            const target = getClosestOrSelf(e.target, "[data-action]");
            const action = target === null || target === void 0 ? void 0 : target.getAttribute("data-action");
            if (action === "fetch-civitai") {
                this.modelInfo = await MODEL_INFO_SERVICE.refreshLora(info.file);
                this.setContent(this.getInfoContent());
            }
            else if (action === "edit-row") {
                const tr = target.closest("tr");
                const td = queryOne("td:nth-child(2)", tr);
                const input = td.querySelector("input,textarea");
                if (!input) {
                    const fieldName = tr.dataset["fieldName"];
                    tr.classList.add("-rgthree-editing");
                    const isTextarea = fieldName === "userNote";
                    const input = $el(`${isTextarea ? "textarea" : 'input[type="text"]'}`, {
                        value: td.textContent,
                    });
                    input.addEventListener("keydown", (e) => {
                        if (!isTextarea && e.key === "Enter") {
                            const modified = saveEditableRow(info, tr, true);
                            this.modifiedModelData = this.modifiedModelData || modified;
                            e.stopPropagation();
                            e.preventDefault();
                        }
                        else if (e.key === "Escape") {
                            const modified = saveEditableRow(info, tr, false);
                            this.modifiedModelData = this.modifiedModelData || modified;
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    });
                    appendChildren(empty(td), [input]);
                    input.focus();
                }
                else if (target.nodeName.toLowerCase() === "button") {
                    const modified = saveEditableRow(info, tr, true);
                    this.modifiedModelData = this.modifiedModelData || modified;
                }
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
    getInfoContent() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const info = this.modelInfo || {};
        const civitaiLink = (_a = info.links) === null || _a === void 0 ? void 0 : _a.find((i) => i.includes("civitai.com/models"));
        const html = `
      <ul class="rgthree-info-tags">
        <li title="Type" class="-type -type-${(info.type || "").toLowerCase()}"><span>${info.type || ""}</span></li>
        <li title="Base Model" class="-basemodel -basemodel-${(info.baseModel || "").toLowerCase()}"><span>${info.baseModel || ""}</span></li>
        <li stub="menu"></li>
        ${!civitaiLink
            ? ""
            : `
          <li title="Visit on Civitai" class="-link -civitai"><a href="${civitaiLink}" target="_blank">${logoCivitai} Civitai ${link}</a></li>
        `}
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
                        ? infoTableRow("Civitai", `<button data-action="fetch-civitai">Fetch info from civitai</button>`)
                        : ""}
        ${infoTableRow("Base Model", info.baseModel || "")}

        ${infoTableRow("Name", info.name || "", "The name for display.", "name")}
        ${infoTableRow("Trigger Words", (_k = (_j = info.triggerWords) === null || _j === void 0 ? void 0 : _j.join(", ")) !== null && _k !== void 0 ? _k : "", "Easily keep track of the trigger words to reference here.", "triggerWords")}
        ${infoTableRow("Strength Min", (_l = info.strengthMin) !== null && _l !== void 0 ? _l : "", "The recommended minimum strength, In the Power Lora Loader node, strength will signal when it is below this threshold.", "strengthMin")}
        ${infoTableRow("Strength Max", (_m = info.strengthMax) !== null && _m !== void 0 ? _m : "", "The recommended maximum strength. In the Power Lora Loader node, strength will signal when it is above this threshold.", "strengthMax")}
        ${""}
        ${infoTableRow("Additional Notes", (_o = info.userNote) !== null && _o !== void 0 ? _o : "", "Additional notes you'd like to keep and reference in the info dialog.", "userNote")}

      </table>

      <ul class="rgthree-info-images">${(_q = (_p = info.images) === null || _p === void 0 ? void 0 : _p.map((img) => {
            var _a;
            return `
        <li>
          <img src="${img.url}" />
          <!--table class="rgthree-info-table">
            <tr><td>Seed</td><td>${img.seed || ""}</td></tr>
            <tr><td>Steps</td><td>${img.steps || ""}</td></tr>
            <tr><td>Cfg</td><td>${img.cfg || ""}</td></tr>
            <tr><td>Sampler</td><td>${img.sampler || ""}</td></tr>
            <tr><td>Model</td><td>${img.model || ""}</td></tr>
            <tr><td>Positive</td><td>${img.positive || ""}</td></tr>
            <tr><td>Negative</td><td>${img.negative || ""}</td></tr>
            ${((_a = img.resources) === null || _a === void 0 ? void 0 : _a.length)
                ? `
              <tr><td>Resources</td><td><ul>
              ${(img.resources || [])
                    .map((r) => `
                <li>[${r.type || ""}] ${r.name || ""} ${r.weight != null ? `@ ${r.weight}` : ""}</li>
              `)
                    .join("")}
              </ul></td></tr>
            `
                : ""}
          </table-->
        </li>`;
        }).join("")) !== null && _q !== void 0 ? _q : ""}</ul>
    `;
        const div = $el("div", { html });
        return div;
    }
}
function infoTableRow(name, value, help = "", editableFieldName = "") {
    return `
    <tr class="${editableFieldName ? "editable" : ""}" ${editableFieldName ? `data-field-name="${editableFieldName}"` : ""}>
      <td><span>${name} ${help ? `<span class="-help" title="${help}"></span>` : ""}<span></td>
      <td ${editableFieldName ? "" : 'colspan="2"'}><span>${value}</span></td>
      ${editableFieldName
        ? `<td style="width: 24px;"><button class="rgthree-button-reset rgthree-button-edit" data-action="edit-row">${pencilColored}${diskColored}</button></td>`
        : ""}
    </tr>`;
}
function saveEditableRow(info, tr, saving = true) {
    var _a;
    const fieldName = tr.dataset["fieldName"];
    const input = queryOne("input,textarea", tr);
    let newValue = (_a = info[fieldName]) !== null && _a !== void 0 ? _a : "";
    let modified = false;
    if (saving) {
        newValue = input.value;
        if (fieldName.startsWith("strength")) {
            if (Number.isNaN(Number(newValue))) {
                alert(`You must enter a number into the ${fieldName} field.`);
                return false;
            }
            newValue = (Math.round(Number(newValue) * 100) / 100).toFixed(2);
        }
        rgthreeApi.saveLoraInfo(info.name, { [fieldName]: newValue });
        modified = true;
    }
    tr.classList.remove("-rgthree-editing");
    const td = queryOne("td:nth-child(2)", tr);
    appendChildren(empty(td), [$el("span", { text: newValue })]);
    return modified;
}
