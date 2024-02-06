import { app } from "../../scripts/app.js";
import { RgthreeDialog } from "../../rgthree/common/dialog.js";
import { createElement as $el, querySelectorAll as $$ } from "../../rgthree/common/utils_dom.js";
import { checkmark, logoRgthree } from "../../rgthree/common/media/svgs.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
var ConfigType;
(function (ConfigType) {
    ConfigType[ConfigType["UNKNOWN"] = 0] = "UNKNOWN";
    ConfigType[ConfigType["BOOLEAN"] = 1] = "BOOLEAN";
    ConfigType[ConfigType["STRING"] = 2] = "STRING";
    ConfigType[ConfigType["NUMBER"] = 3] = "NUMBER";
})(ConfigType || (ConfigType = {}));
const TYPE_TO_STRING = {
    [ConfigType.UNKNOWN]: "unknown",
    [ConfigType.BOOLEAN]: "boolean",
    [ConfigType.STRING]: "string",
    [ConfigType.NUMBER]: "number",
};
const CONFIGURABLE = {
    features: [
        {
            key: "features.patch_recursive_execution",
            type: ConfigType.BOOLEAN,
            label: "Optimize ComfyUI's Execution",
            description: "Patches ComfyUI's backend execution making complex workflows 1000's of times faster." +
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
                {
                    key: "features.progress_bar.position",
                    type: ConfigType.STRING,
                    label: "Position at top or bottom of window",
                    options: ["top", "bottom"],
                },
            ],
        },
        {
            key: "features.menu_queue_selected_nodes",
            type: ConfigType.BOOLEAN,
            label: "Show 'Queue Selected Output Nodes' menu item",
            description: "Will show a menu item in the right-click context menus to queue (only) the selected " +
                "output nodes.",
        },
        {
            key: "features.show_alerts_for_corrupt_workflows",
            type: ConfigType.BOOLEAN,
            label: "Detect Corrupt Workflows",
            description: "Will show a message at the top of the screen when loading a workflow that has " +
                "corrupt linking data.",
        },
    ],
};
function fieldrow(item) {
    var _a;
    const initialValue = CONFIG_SERVICE.getConfigValue(item.key);
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
    if ((_a = item.options) === null || _a === void 0 ? void 0 : _a.length) {
        input = $el(`select[id="${item.key}"]`, {
            parent: container,
            children: item.options.map((o) => {
                return $el(`option[value="${String(o)}"]`, {
                    text: String(o),
                    selected: o === initialValue,
                });
            }),
        });
    }
    else if (item.type === ConfigType.BOOLEAN) {
        container.classList.toggle("-checked", initialValue);
        input = $el(`input[type="checkbox"][id="${item.key}"]`, {
            parent: container,
            checked: initialValue,
        });
    }
    else {
        input = $el(`input[id="${item.key}"]`, {
            parent: container,
            value: initialValue,
        });
    }
    $el("div.fieldrow-value", { children: [input], parent: container });
    return container;
}
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
            $$(".save-button", this.element)[0].disabled =
                !Object.keys(changed).length;
        });
        content.addEventListener("change", (e) => {
            const changed = this.getChangedFormData();
            $$(".save-button", this.element)[0].disabled =
                !Object.keys(changed).length;
        });
        const options = {
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
                        const success = await CONFIG_SERVICE.setConfigValues(changed);
                        if (success) {
                            this.close();
                            rgthree.showMessage({
                                id: "config-success",
                                message: `${checkmark} Successfully saved rgthree-comfy settings!`,
                                timeout: 4000,
                            });
                            $$(".save-button", this.element)[0].disabled = true;
                        }
                        else {
                            alert("There was an error saving rgthree-comfy configuration.");
                        }
                    },
                },
            ],
        };
        super(options);
    }
    getChangedFormData() {
        return $$("[data-name]", this.contentElement).reduce((acc, el) => {
            const name = el.dataset["name"];
            const type = el.dataset["type"];
            const initialValue = CONFIG_SERVICE.getConfigValue(name);
            let currentValueEl = $$("input, textarea, select", el)[0];
            let currentValue = null;
            if (type === String(ConfigType.BOOLEAN)) {
                currentValue = currentValueEl.checked;
                el.classList.toggle("-checked", currentValue);
            }
            else {
                currentValue = currentValueEl === null || currentValueEl === void 0 ? void 0 : currentValueEl.value;
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
        return $el("tr.rgthree-comfyui-settings-row", {
            children: [
                $el("td", {
                    child: `<div>${logoRgthree} [rgthree-comfy] configuration / settings</div>`,
                }),
                $el("td", {
                    child: $el('button.rgthree-button.-blue[text="rgthree-comfy settings"]', {
                        events: {
                            click: (e) => {
                                new RgthreeConfigDialog().show();
                            },
                        },
                    }),
                }),
            ],
        });
    },
});
