import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
app.registerExtension({
    name: "rgthree.ContextMenuAutoNest",
    async setup() {
        const logger = rgthree.newLogSession('[ContextMenuAutoNest]');
        const existingContextMenu = LiteGraph.ContextMenu;
        LiteGraph.ContextMenu = function (values, options) {
            var _a, _b;
            const threshold = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.threshold", 20);
            const enabled = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.subdirs", false);
            if (!enabled
                || ((values === null || values === void 0 ? void 0 : values.length) || 0) <= threshold
                || !(options === null || options === void 0 ? void 0 : options.callback)
                || values.some(i => typeof i !== 'string')) {
                if (enabled) {
                    const [n, v] = logger.infoParts('Skipping context menu auto nesting for incompatible menu.');
                    (_a = console[n]) === null || _a === void 0 ? void 0 : _a.call(console, ...v);
                }
                console.log('just pass through.');
                return existingContextMenu.apply(this, [...arguments]);
            }
            const compatValues = values;
            const originalValues = [...compatValues];
            const folders = {};
            const specialOps = [];
            const folderless = [];
            for (const value of compatValues) {
                const splitBy = value.indexOf('/') > -1 ? '/' : '\\';
                const valueSplit = value.split(splitBy);
                if (valueSplit.length > 1) {
                    const key = valueSplit.shift();
                    folders[key] = folders[key] || [];
                    folders[key].push(valueSplit.join(splitBy));
                }
                else if (value === 'CHOOSE' || value.startsWith('DISABLE ')) {
                    specialOps.push(value);
                }
                else {
                    folderless.push(value);
                }
            }
            const foldersCount = Object.values(folders).length;
            if (foldersCount > 0) {
                const oldcallback = options.callback;
                options.callback = null;
                const newCallback = (item, options) => {
                    oldcallback(originalValues.find(i => i.endsWith(item.content), options));
                };
                const [n, v] = logger.infoParts(`Nested folders found (${foldersCount}).`);
                (_b = console[n]) === null || _b === void 0 ? void 0 : _b.call(console, ...v);
                const newValues = [];
                for (const [folderName, folder] of Object.entries(folders)) {
                    newValues.push({
                        content: folderName,
                        has_submenu: true,
                        callback: () => { },
                        submenu: {
                            options: folder.map(f => ({
                                content: f,
                                callback: newCallback
                            })),
                        }
                    });
                }
                values = [].concat(specialOps.map(f => ({
                    content: f,
                    callback: newCallback
                })), newValues, folderless.map(f => ({
                    content: f,
                    callback: newCallback
                })));
            }
            return existingContextMenu.call(this, values, options);
        };
        LiteGraph.ContextMenu.prototype = existingContextMenu.prototype;
    },
});
