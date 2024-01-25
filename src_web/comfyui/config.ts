// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { rgthreeConfig } from "rgthree/config.js";
import { RgthreeDialog, RgthreeDialogOptions } from "rgthree/common/dialog.js";
import { rgthreeApi } from "rgthree/common/rgthree_api.js";
import { getObjectValue, setObjectValue } from "rgthree/common/shared_utils.js";
import { createElement as $el, querySelectorAll as $$ } from "rgthree/common/utils_dom.js";
import { logoRgthree } from "rgthree/common/media/svgs.js";
import { rgthree } from "./rgthree.js";

/** Types of config used as a hint for the form handling. */
enum ConfigType {
  UNKNOWN,
  BOOLEAN,
}

const TYPE_TO_STRING = {
  [ConfigType.UNKNOWN]: 'unknown',
  [ConfigType.BOOLEAN]: 'boolean',
};

/**
 * A static schema of sorts to layout options found in the config.
 */
const CONFIGURABLE = {
  features: [
    {
      key: "features.patch_recursive_execution",
      type: ConfigType.BOOLEAN,
      label: "Optimize ComfyUI's Execution",
      description:
        "Patches ComfyUI's backend execution making complex workflows 1000's of times faster." +
        "<br>⚠️ Disable if execution seems broken due to forward ComfyUI changes.",
    },
    // {
    //   key: "features.progress_bar.enabled",
    //   type: ConfigType.BOOLEAN,
    //   label: "Prompt Progress Bar",
    //   description: `Shows a minimal progress bar for nodes and steps at the top of the app.`,
    // },
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
 * A dialog to edit rgthree-comfy settings and config.
 */
export class RgthreeConfigDialog extends RgthreeDialog {
  constructor() {
    const content = $el("div");
    const features = $el(`fieldset`, { children: [$el(`legend[text="Features"]`)] });
    for (const feature of CONFIGURABLE.features) {
      const label = $el(`label[for="${feature.key}"]`, {
        children: [$el(`span[text="${feature.label}"]`)],
      });
      if (feature.description) {
        label.appendChild($el("small", { html: feature.description }));
      }
      let input;
      const initialValue = getObjectValue(rgthreeConfig, feature.key);
      console.log(feature.key, initialValue, typeof initialValue);
      if (feature.type === ConfigType.BOOLEAN) {
        input = $el<HTMLInputElement>(`input[type="checkbox"][id="${feature.key}"]`, {});
        input.checked = initialValue;
      } else {
        input = $el("input");
      }
      features.appendChild(
        $el(`div.formrow.-type-${TYPE_TO_STRING[feature.type]}`, {
          dataset: {
            name: feature.key,
            initial: initialValue,
            type: feature.type,
          },
          children: [label, $el("div.formrow-value", { children: [input] })],
        }),
      );
    }
    content.appendChild(features);

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
              console.log("nothing has changed.");
              this.close();
              return;
            }
            const success = await SERVICE.setConfigValues(changed);
            if (success) {
              this.close();
              rgthree.showMessage({
                id: "config-success",
                message: "Successfully saved rgthree-comfy config!",
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
      let currentValueEl = $$("input, textarea", el)[0];
      let currentValue: any = null;
      if (type === String(ConfigType.BOOLEAN)) {
        currentValue = (currentValueEl as HTMLInputElement).checked;
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
                console.log("click!", e);
                new RgthreeConfigDialog().show();
              },
            },
          }),
        }),
      ],
    });
  },
});
