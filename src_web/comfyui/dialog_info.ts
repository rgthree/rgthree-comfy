import { RgthreeDialog, RgthreeDialogOptions } from "rgthree/common/dialog.js";
import {
  createElement as $el,
  empty,
  appendChildren,
  getClosestOrSelf,
  queryOne,
  setAttributes,
} from "rgthree/common/utils_dom.js";
import {
  logoCivitai,
  link,
  pencilColored,
  diskColored,
  dotdotdot,
} from "rgthree/common/media/svgs.js";
import { rgthreeApi } from "rgthree/common/rgthree_api.js";
import { RgthreeModelInfo } from "typings/rgthree.js";
import { SERVICE as MODEL_INFO_SERVICE } from "rgthree/common/model_info_service.js";

/**
 * A dialog that displays information about a model/lora/etc.
 */
export class RgthreeInfoDialog extends RgthreeDialog {
  private modifiedModelData = false;
  private modelInfo: RgthreeModelInfo | null = null;

  constructor(file: string) {
    const dialogOptions: RgthreeDialogOptions = {
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
          callback: async (e) => {},
        },
      ],
    };
    super(dialogOptions);
    this.init(file);
  }

  private async init(file: string) {
    this.modelInfo = await MODEL_INFO_SERVICE.getLora(file);
    this.setContent(this.getInfoContent());
    this.setTitle(this.modelInfo?.["name"] || this.modelInfo?.["file"] || "Unknown");
    this.attachEvents();
  }

  protected override getCloseEventDetail(): { detail: any } {
    const detail = {
      dirty: this.modifiedModelData,
    };
    return { detail };
  }

  private attachEvents() {
    this.contentElement.addEventListener("click", async (e: MouseEvent) => {
      const info = this.modelInfo;
      if (!info?.file) {
        return;
      }

      const target = getClosestOrSelf(e.target as HTMLElement, "[data-action]");
      const action = target?.getAttribute("data-action");
      if (action === "fetch-civitai") {
        this.modelInfo = await MODEL_INFO_SERVICE.refreshLora(info.file);
        this.setContent(this.getInfoContent());
      } else if (action === "edit-row") {
        const tr = target!.closest("tr")!;
        const td = queryOne("td:nth-child(2)", tr)!;
        const input = td.querySelector("input,textarea");
        if (!input) {
          const fieldName = tr.dataset["fieldName"] as string;
          tr.classList.add("-rgthree-editing");
          const isTextarea = fieldName === "userNote";
          const input = $el(`${isTextarea ? "textarea" : 'input[type="text"]'}`, {
            value: td.textContent,
          });
          input.addEventListener("keydown", (e) => {
            if (!isTextarea && e.key === "Enter") {
              const modified = saveEditableRow(info!, tr, true);
              this.modifiedModelData = this.modifiedModelData || modified;
              e.stopPropagation();
              e.preventDefault();
            } else if (e.key === "Escape") {
              const modified = saveEditableRow(info!, tr, false);
              this.modifiedModelData = this.modifiedModelData || modified;
              e.stopPropagation();
              e.preventDefault();
            }
          });
          appendChildren(empty(td), [input]);
          input.focus();
        } else if (target!.nodeName.toLowerCase() === "button") {
          const modified = saveEditableRow(info!, tr, true);
          this.modifiedModelData = this.modifiedModelData || modified;
        }
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  private getInfoContent() {
    const info = this.modelInfo || {};
    const civitaiLink = info.links?.find((i) => i.includes("civitai.com/models"));
    const html = `
      <ul class="rgthree-info-tags">
        <li title="Type" class="-type -type-${(info.type || "").toLowerCase()}"><span>${
          info.type || ""
        }</span></li>
        <li title="Base Model" class="-basemodel -basemodel-${(
          info.baseModel || ""
        ).toLowerCase()}"><span>${info.baseModel || ""}</span></li>
        <li stub="menu"></li>
        ${
          !civitaiLink
            ? ""
            : `
          <li title="Visit on Civitai" class="-link -civitai"><a href="${civitaiLink}" target="_blank">${logoCivitai} Civitai ${link}</a></li>
        `
        }
      </ul>

      <table class="rgthree-info-table">
        ${infoTableRow("File", info.file || "")}
        ${infoTableRow("Hash (sha256)", info.sha256 || "")}
        ${
          civitaiLink
            ? infoTableRow(
                "Civitai",
                `<a href="${civitaiLink}" target="_blank">${logoCivitai}View on Civitai</a>`,
              )
            : info.raw?.civitai?.error === "Model not found"
            ? infoTableRow(
                "Civitai",
                '<i>Model not found</i> <span class="-help" title="The model was not found on civitai with the sha256 hash. It\'s possible the model was removed, re-uploaded, or was never on civitai to begin with."></span>',
              )
            : info.raw?.civitai?.error
            ? infoTableRow("Civitai", info.raw?.civitai?.error)
            : !info.raw?.civitai
            ? infoTableRow(
                "Civitai",
                `<button data-action="fetch-civitai">Fetch info from civitai</button>`,
              )
            : ""
        }
        ${infoTableRow("Base Model", info.baseModel || "")}

        ${infoTableRow("Name", info.name || "", "The name for display.", "name")}
        ${infoTableRow(
          "Trigger Words",
          info.triggerWords?.join(", ") ?? "",
          "Easily keep track of the trigger words to reference here.",
          "triggerWords",
        )}
        ${infoTableRow(
          "Strength Min",
          info.strengthMin ?? "",
          "The recommended minimum strength, In the Power Lora Loader node, strength will signal when it is below this threshold.",
          "strengthMin",
        )}
        ${infoTableRow(
          "Strength Max",
          info.strengthMax ?? "",
          "The recommended maximum strength. In the Power Lora Loader node, strength will signal when it is above this threshold.",
          "strengthMax",
        )}
        ${
          "" /*infoTableRow(
          "User Tags",
          info.userTags?.join(", ") ?? "",
          "A list of tags to make filtering easier  in the Power Lora Chooser.",
          "userTags",
        )*/
        }
        ${infoTableRow(
          "Additional Notes",
          info.userNote ?? "",
          "Additional notes you'd like to keep and reference in the info dialog.",
          "userNote",
        )}

      </table>

      <ul class="rgthree-info-images">${
        info.images
          ?.map(
            (img) => `
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
            ${
              img.resources?.length
                ? `
              <tr><td>Resources</td><td><ul>
              ${(img.resources || [])
                .map(
                  (r) => `
                <li>[${r.type || ""}] ${r.name || ""} ${
                  r.weight != null ? `@ ${r.weight}` : ""
                }</li>
              `,
                )
                .join("")}
              </ul></td></tr>
            `
                : ""
            }
          </table-->
        </li>`,
          )
          .join("") ?? ""
      }</ul>
    `;

    const div = $el("div", { html });

    return div;
  }
}

/**
 * Generates a uniform markup string for a table row.
 */
function infoTableRow(
  name: string,
  value: string | number,
  help: string = "",
  editableFieldName = "",
) {
  return `
    <tr class="${editableFieldName ? "editable" : ""}" ${
      editableFieldName ? `data-field-name="${editableFieldName}"` : ""
    }>
      <td><span>${name} ${help ? `<span class="-help" title="${help}"></span>` : ""}<span></td>
      <td ${editableFieldName ? "" : 'colspan="2"'}><span>${value}</span></td>
      ${
        editableFieldName
          ? `<td style="width: 24px;"><button class="rgthree-button-reset rgthree-button-edit" data-action="edit-row">${pencilColored}${diskColored}</button></td>`
          : ""
      }
    </tr>`;
}

/**
 * Saves / cancels an editable row. Returns a boolean if the data was modified.
 */
function saveEditableRow(info: RgthreeModelInfo, tr: HTMLElement, saving = true): boolean {
  const fieldName = tr.dataset["fieldName"] as "file";
  const input = queryOne<HTMLInputElement>("input,textarea", tr)!;
  let newValue = info[fieldName] ?? "";
  let modified = false;
  if (saving) {
    newValue = input!.value;
    if (fieldName.startsWith("strength")) {
      if (Number.isNaN(Number(newValue))) {
        alert(`You must enter a number into the ${fieldName} field.`);
        return false;
      }
      newValue = (Math.round(Number(newValue) * 100) / 100).toFixed(2);
    }
    rgthreeApi.saveLoraInfo(info.name!, { [fieldName]: newValue });
    modified = true;
  }
  tr.classList.remove("-rgthree-editing");
  const td = queryOne("td:nth-child(2)", tr)!;
  appendChildren(empty(td), [$el("span", { text: newValue })]);
  return modified;
}
