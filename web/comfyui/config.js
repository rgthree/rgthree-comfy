import { app } from "../../scripts/app.js";
import { RgthreeDialog } from "../../rgthree/common/dialog.js";
import { createElement as $el, query as $$ } from "../../rgthree/common/utils_dom.js";
import { checkmark, logoRgthree } from "../../rgthree/common/media/svgs.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
var ConfigType;
(function (ConfigType) {
    ConfigType[ConfigType["UNKNOWN"] = 0] = "UNKNOWN";
    ConfigType[ConfigType["BOOLEAN"] = 1] = "BOOLEAN";
    ConfigType[ConfigType["STRING"] = 2] = "STRING";
    ConfigType[ConfigType["NUMBER"] = 3] = "NUMBER";
    ConfigType[ConfigType["ARRAY"] = 4] = "ARRAY";
})(ConfigType || (ConfigType = {}));
const TYPE_TO_STRING = {
    [ConfigType.UNKNOWN]: "unknown",
    [ConfigType.BOOLEAN]: "boolean",
    [ConfigType.STRING]: "string",
    [ConfigType.NUMBER]: "number",
    [ConfigType.ARRAY]: "array",
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
            label: "(Menu) Show 'Queue Selected Output Nodes'",
            description: "Will show a menu item in the right-click context menus to queue (only) the selected " +
                "output nodes.",
        },
        {
            key: "features.menu_auto_nest.subdirs",
            type: ConfigType.BOOLEAN,
            label: "(Menu) Auto Nest Subdirectories",
            description: "When a large, flat list of values contain sub-directories, auto nest them. (Like, for " +
                "a large list of checkpoints).",
            subconfig: [
                {
                    key: "features.menu_auto_nest.threshold",
                    type: ConfigType.NUMBER,
                    label: "Number of items needed to trigger nesting.",
                },
            ],
        },
        {
            key: "features.menu_bookmarks.enabled",
            type: ConfigType.BOOLEAN,
            label: "(Menu) Show bookmark shortcuts in context menu",
            description: "Will list bookmarks in the rgthree-comfy context menu.",
        },
        {
            key: "features.group_header_fast_toggle.enabled",
            type: ConfigType.BOOLEAN,
            label: "(Groups) Show fast toggles in Group Headers",
            description: "Show quick toggles in Groups' Headers to quickly mute and/or bypass.",
            subconfig: [
                {
                    key: "features.group_header_fast_toggle.toggles",
                    type: ConfigType.ARRAY,
                    label: "Which toggles to show.",
                    options: [
                        { value: ["mute"], label: "mute only" },
                        { value: ["bypass"], label: "bypass only" },
                        { value: ["mute", "bypass"], label: "mute and bypass" },
                    ],
                },
                {
                    key: "features.group_header_fast_toggle.show",
                    type: ConfigType.STRING,
                    label: "When to show them.",
                    options: [
                        { value: "hover", label: "on hover" },
                        { value: "always", label: "always" },
                    ],
                },
            ],
        },
        {
            key: "features.show_alerts_for_corrupt_workflows",
            type: ConfigType.BOOLEAN,
            label: "Detect Corrupt Workflows",
            description: "Will show a message at the top of the screen when loading a workflow that has " +
                "corrupt linking data.",
        },
        {
            key: "log_level",
            type: ConfigType.STRING,
            label: "Log level for browser dev console.",
            description: "Further down the list, the more verbose logs to the console will be. For instance, " +
                "selecting 'IMPORTANT' means only important message will be logged to the browser " +
                "console, while selecting 'WARN' will log all messages at or higher than WARN, including " +
                "'ERROR' and 'IMPORTANT' etc.",
            options: ["IMPORTANT", "ERROR", "WARN", "INFO", "DEBUG", "DEV"],
            isDevOnly: true,
            onSave: function (value) {
                rgthree.setLogLevel(value);
            },
        },
        {
            key: "features.invoke_extensions_async.node_created",
            type: ConfigType.BOOLEAN,
            label: "Allow other extensions to call nodeCreated on rgthree-nodes.",
            isDevOnly: true,
            description: "Do not disable unless you are having trouble (and then file an issue at rgthree-comfy)." +
                "Prior to Apr 2024 it was not possible for other extensions to invoke their nodeCreated " +
                "event on some rgthree-comfy nodes. Now it's possible and this option is only here in " +
                "for easy if something is wrong.",
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
                const label = o.label || String(o);
                const value = o.value || o;
                const valueSerialized = JSON.stringify({ value: value });
                return $el(`option[value="${valueSerialized}"]`, {
                    text: label,
                    selected: valueSerialized === JSON.stringify({ value: initialValue }),
                });
            }),
        });
    }
    else if (item.type === ConfigType.BOOLEAN) {
        container.classList.toggle("-checked", !!initialValue);
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
            if (feature.isDevOnly && !rgthree.isDevMode()) {
                continue;
            }
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
        const dialogOptions = {
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
                        var _a, _b;
                        const changed = this.getChangedFormData();
                        if (!Object.keys(changed).length) {
                            this.close();
                            return;
                        }
                        const success = await CONFIG_SERVICE.setConfigValues(changed);
                        if (success) {
                            for (const key of Object.keys(changed)) {
                                (_b = (_a = CONFIGURABLE.features.find(f => f.key === key)) === null || _a === void 0 ? void 0 : _a.onSave) === null || _b === void 0 ? void 0 : _b.call(_a, changed[key]);
                            }
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
        super(dialogOptions);
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
                if (currentValueEl.nodeName === 'SELECT') {
                    currentValue = JSON.parse(currentValue).value;
                }
                else if (type === String(ConfigType.NUMBER)) {
                    currentValue = Number(currentValue) || initialValue;
                }
            }
            if (JSON.stringify(currentValue) !== JSON.stringify(initialValue)) {
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
