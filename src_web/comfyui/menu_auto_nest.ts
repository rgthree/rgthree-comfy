import { app } from "scripts/app.js";
import type {
  ContextMenuItem,
  LGraphNode,
  ContextMenu,
  IContextMenuOptions,
} from "typings/litegraph.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./services/config_service.js";

const SPECIAL_ENTRIES = [/^(CHOOSE|NONE|DISABLE|OPEN)(\s|$)/i, /^\p{Extended_Pictographic}/gu];

/**
 * Handles a large, flat list of string values given ContextMenu and breaks it up into subfolder, if
 * they exist. This is experimental and initially built to work for CheckpointLoaderSimple.
 */
app.registerExtension({
  name: "rgthree.ContextMenuAutoNest",
  async setup() {
    const logger = rgthree.newLogSession("[ContextMenuAutoNest]");

    const existingContextMenu = LiteGraph.ContextMenu;

    // @ts-ignore: TypeScript doesn't like this override.
    LiteGraph.ContextMenu = function (values: ContextMenuItem[], options: IContextMenuOptions) {
      const threshold = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.threshold", 20);
      const enabled = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.subdirs", false);

      // If we're not enabled, or are incompatible, then just call out safely.
      let incompatible: string | boolean = !enabled || !!options?.extra?.rgthree_doNotNest;
      if (!incompatible) {
        if (values.length <= threshold) {
          incompatible = `Skipping context menu auto nesting b/c threshold is not met (${threshold})`;
        }
        // If there's a rgthree_originalCallback, then we're nested and don't need to check things
        // we only expect on the first nesting.
        if (!options.parentMenu?.options.rgthree_originalCallback) {
          // On first context menu, we require a callback and a flat list of options as strings.
          if (!options?.callback) {
            incompatible = `Skipping context menu auto nesting b/c a callback was expected.`;
          } else if (values.some((i) => typeof i !== "string")) {
            incompatible = `Skipping context menu auto nesting b/c not all values were strings.`;
          }
        }
      }
      if (incompatible) {
        if (enabled) {
          const [n, v] = logger.infoParts(
            "Skipping context menu auto nesting for incompatible menu.",
          );
          console[n]?.(...v);
        }
        return existingContextMenu.apply(this as any, [...arguments] as any);
      }

      const folders: { [key: string]: ContextMenuItem[] } = {};
      const specialOps: ContextMenuItem[] = [];
      const folderless: ContextMenuItem[] = [];
      for (const value of values) {
        if (!value) {
          folderless.push(value);
          continue;
        }
        const newValue = typeof value === "string" ? { content: value } : Object.assign({}, value);
        newValue.rgthree_originalValue = value.rgthree_originalValue || value;
        const valueContent = newValue.content || '';
        const splitBy = valueContent.indexOf("/") > -1 ? "/" : "\\";
        const valueSplit = valueContent.split(splitBy);
        if (valueSplit.length > 1) {
          const key = valueSplit.shift()!;
          newValue.content = valueSplit.join(splitBy);
          folders[key] = folders[key] || [];
          folders[key]!.push(newValue);
        } else if (SPECIAL_ENTRIES.some((r) => r.test(valueContent))) {
          specialOps.push(newValue);
        } else {
          folderless.push(newValue);
        }
      }

      const foldersCount = Object.values(folders).length;
      if (foldersCount > 0) {
        // Propogate the original callback down through the options.
        options.rgthree_originalCallback =
          options.rgthree_originalCallback ||
          options.parentMenu?.options.rgthree_originalCallback ||
          options.callback;
        const oldCallback = options.rgthree_originalCallback;
        options.callback = undefined;
        const newCallback = (
          item: ContextMenuItem,
          options: IContextMenuOptions,
          event: MouseEvent,
          parentMenu: ContextMenu | undefined,
          node: LGraphNode,
        ) => {
          oldCallback?.(item?.rgthree_originalValue!, options, event, undefined, node);
        };
        const [n, v] = logger.infoParts(`Nested folders found (${foldersCount}).`);
        console[n]?.(...v);
        const newValues: ContextMenuItem[] = [];
        for (const [folderName, folderValues] of Object.entries(folders)) {
          newValues.push({
            content: `📁 ${folderName}`,
            has_submenu: true,
            callback: () => {
              /* no-op, use the item callback. */
            },
            submenu: {
              options: folderValues.map((value) => {
                value!.callback = newCallback;
                return value;
              }),
            },
          });
        }
        values = ([] as ContextMenuItem[]).concat(
          specialOps.map((f) => {
            if (typeof f === "string") {
              f = { content: f };
            }
            f!.callback = newCallback;
            return f;
          }),
          newValues,
          folderless.map((f) => {
            if (typeof f === "string") {
              f = { content: f };
            }
            f!.callback = newCallback;
            return f;
          }),
        );
      }
      if (options.scale == null) {
        options.scale = Math.max(app.canvas.ds?.scale || 1, 1);
      }
      return existingContextMenu.call(this as any, values, options);
    };

    LiteGraph.ContextMenu.prototype = existingContextMenu.prototype;
  },
});
