// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { rgthreeConfig } from "rgthree/config.js";
import { RgthreeDialog, RgthreeDialogOptions } from "rgthree/common/dialog.js";
import { rgthreeApi } from "rgthree/common/rgthree_api.js";
import { getObjectValue, setObjectValue } from "rgthree/common/shared_utils.js";
import { createElement as $el, querySelectorAll as $$ } from "rgthree/common/utils_dom.js";
import { checkmark, logoRgthree } from "rgthree/common/media/svgs.js";
import { rgthree } from "./rgthree.js";

/** Types of config used as a hint for the form handling. */
enum ConfigType {
  UNKNOWN,
  BOOLEAN,
  STRING,
  NUMBER,
}

const TYPE_TO_STRING = {
  [ConfigType.UNKNOWN]: "unknown",
  [ConfigType.BOOLEAN]: "boolean",
  [ConfigType.STRING]: "string",
  [ConfigType.NUMBER]: "number",
};

type ConfigurationSchema = {
  key: string;
  type: ConfigType;
  label: string;
  description?: string;
  subconfig?: ConfigurationSchema[];
};

/**
 * A static schema of sorts to layout options found in the config.
 */
const CONFIGURABLE: { features: ConfigurationSchema[] } = {
  features: [
    {
      key: "features.patch_recursive_execution",
      type: ConfigType.BOOLEAN,
      label: "Optimize ComfyUI's Execution",
      description:
        "Patches ComfyUI's backend execution making complex workflows 1000's of times faster." +
        "<br>⚠️ Disable if execution seems broken due to forward ComfyUI changes.",
    },
    {
      key: "features.progress_bar.enabled",
      type: ConfigType.BOOLEAN,
      label: "Prompt Progress Bar",
      description: `Shows a minimal progress bar for nodes and steps at the top of the app.`,
      subconfig: [
        {
          key: "features.progress_bar.height",
          type: ConfigType.NUMBER,
          label: "Height of the bar",
        },
      ],
    },
    {
      key: "features.show_alerts_for_corrupt_workflows",
      type: ConfigType.BOOLEAN,
      label: "Detect Corrupt Workflows",
      description:
        "Will show a message at the top of the screen when loading a workflow that has " +
        "corrupt linking data.",
    },
  ],
};

/**
 * A singleton service exported as `SERVICE` to handle configuration routines.
 */
class ConfigService extends EventTarget {
  getConfigValue(key: string, def?: any) {
    return getObjectValue(rgthreeConfig, key, def);
  }

  /**
   * Given an object of key:value changes it will send to the server and wait for a successful
   * response before setting the values on the local rgthreeConfig.
   */
  async setConfigValues(changed: { [key: string]: any }) {
    const body = new FormData();
    body.append("json", JSON.stringify(changed));
    const response = await rgthreeApi.fetchJson("/config", { method: "POST", body });
    if (response.status === "ok") {
      for (const [key, value] of Object.entries(changed)) {
        setObjectValue(rgthreeConfig, key, value);
        this.dispatchEvent(new CustomEvent("config-change", { detail: { key, value } }));
      }
    } else {
      return false;
    }
    return true;
  }
}

/** The ConfigService singleton. */
export const SERVICE = new ConfigService();

/**
 * Creates a new fieldrow for main or sub configuration items.
 */
function fieldrow(item: ConfigurationSchema) {
  const initialValue = SERVICE.getConfigValue(item.key);
  const container = $el(`div.fieldrow.-type-${TYPE_TO_STRING[item.type]}`, {
    dataset: {
      name: item.key,
      initial: initialValue,
      type: item.type,
    },
  });

  $el(`label[for="${item.key}"]`, {
    children: [
      $el(`span[text="${item.label}"]`),
      item.description ? $el("small", { html: item.description }) : null,
    ],
    parent: container,
  });

  let input;
  if (item.type === ConfigType.BOOLEAN) {
    container.classList.toggle("-checked", initialValue);
    input = $el<HTMLInputElement>(`input[type="checkbox"][id="${item.key}"]`, {
      checked: initialValue,
      parent: container,
    });
  } else {
    input = $el(`input[id="${item.key}"]`, {
      value: initialValue,
      parent: container,
    });
  }
  $el("div.fieldrow-value", { children: [input], parent: container });
  return container;
}

/**
 * A dialog to edit rgthree-comfy settings and config.
 */
export class RgthreeConfigDialog extends RgthreeDialog {
  constructor() {
    const content = $el("div");
    const features = $el(`fieldset`, { children: [$el(`legend[text="Features"]`)] });

    for (const feature of CONFIGURABLE.features) {
      const container = $el("div.formrow");
      container.appendChild(fieldrow(feature));

      if (feature.subconfig) {
        for (const subfeature of feature.subconfig) {
          container.appendChild(fieldrow(subfeature));
        }
      }

      features.appendChild(container);
    }
    content.appendChild(features);

    content.addEventListener("input", (e) => {
      const changed = this.getChangedFormData();
      ($$(".save-button", this.element)[0] as HTMLButtonElement).disabled =
        !Object.keys(changed).length;
    });
    content.addEventListener("change", (e) => {
      const changed = this.getChangedFormData();
      ($$(".save-button", this.element)[0] as HTMLButtonElement).disabled =
        !Object.keys(changed).length;
    });

    const options: RgthreeDialogOptions = {
      class: "-iconed -settings",
      title: logoRgthree + `<h2>Settings - rgthree-comfy</h2>`,
      content,
      onBeforeClose: () => {
        const changed = this.getChangedFormData();
        if (Object.keys(changed).length) {
          return confirm("Looks like there are unsaved changes. Are you sure you want close?");
        }
        return true;
      },
      buttons: [
        {
          label: "Save",
          disabled: true,
          className: "rgthree-button save-button -blue",
          callback: async (e) => {
            const changed = this.getChangedFormData();
            if (!Object.keys(changed).length) {
              this.close();
              return;
            }
            const success = await SERVICE.setConfigValues(changed);
            if (success) {
              this.close();
              rgthree.showMessage({
                id: "config-success",
                message: `${checkmark} Successfully saved rgthree-comfy settings!`,
                timeout: 4000,
              });
              ($$(".save-button", this.element)[0] as HTMLButtonElement).disabled = true;
            } else {
              alert("There was an error saving rgthree-comfy configuration.");
            }
          },
        },
      ],
    };
    super(options);
  }

  getChangedFormData() {
    return $$("[data-name]", this.contentElement).reduce((acc: { [key: string]: any }, el) => {
      const name = el.dataset["name"]!;
      const type = el.dataset["type"]!;
      const initialValue = getObjectValue(rgthreeConfig, name);
      let currentValueEl = $$("input, textarea", el)[0] as HTMLInputElement;
      let currentValue: any = null;
      if (type === String(ConfigType.BOOLEAN)) {
        currentValue = currentValueEl.checked;
        // Not sure I like this side effect in here, but it's easy to just do it now.
        el.classList.toggle("-checked", currentValue);
      } else {
        currentValue = currentValueEl?.value;
        if (type === String(ConfigType.NUMBER)) {
          currentValue = Number(currentValue) || initialValue;
        }
      }
      if (currentValue !== initialValue) {
        acc[name] = currentValue;
      }
      return acc;
    }, {});
  }
}

app.ui.settings.addSetting({
  id: "rgthree.config",
  name: "Open rgthree-comfy config",
  type: () => {
    // Adds a row to open the dialog from the ComfyUI settings.
    return $el("tr.rgthree-comfyui-settings-row", {
      children: [
        $el("td", {
          child: `<div>${logoRgthree} [rgthree-comfy] configuration / settings</div>`,
        }),
        $el("td", {
          child: $el('button.rgthree-button.-blue[text="rgthree-comfy settings"]', {
            events: {
              click: (e: PointerEvent) => {
                new RgthreeConfigDialog().show();
              },
            },
          }),
        }),
      ],
    });
  },
});
