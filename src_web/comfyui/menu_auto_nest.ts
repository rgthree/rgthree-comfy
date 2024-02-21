
// @ts-ignore
import { app } from "../../scripts/app.js";
import type { ContextMenuItem, LiteGraph as TLiteGraph, ContextMenu, } from "typings/litegraph.js";
import {rgthree} from "./rgthree.js"
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";

declare const LiteGraph: typeof TLiteGraph;


/**
 * Handles a large, flat list of string values given ContextMenu and breaks it up into subfolder, if
 * they exist. This is experimental and initially built to work for CheckpointLoaderSimple.
 */
app.registerExtension({
  name: "rgthree.ContextMenuAutoNest",
  async setup() {

    const logger = rgthree.newLogSession('[ContextMenuAutoNest]');


		const existingContextMenu = LiteGraph.ContextMenu;

    // @ts-ignore: TypeScript doesn't like this override.
		LiteGraph.ContextMenu = function (values: ContextMenuItem[], options: any) {
      const threshold = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.threshold", 20);
      const enabled = CONFIG_SERVICE.getConfigValue("features.menu_auto_nest.subdirs", false);

      // If we're not enabled, or are incompatible, then just call out safely.
      if (!enabled
          || (values?.length || 0) <= threshold
          || !options?.callback
          || values.some(i => typeof i !== 'string')) {
        if (enabled) {
          const [n, v] = logger.infoParts('Skipping context menu auto nesting for incompatible menu.');
          console[n]?.(...v);
        }
        console.log('just pass through.')
        return existingContextMenu.apply(this as any, [...arguments] as any);
      }

      // For now, only allow string values.
      const compatValues = values as unknown as string[];
      const originalValues = [...compatValues];
      const folders: {[key:string]: string[]} = {};
      const specialOps: string[] = [];
      const folderless: string[] = [];
      for (const value of compatValues) {
        const splitBy = value.indexOf('/') > -1 ? '/' : '\\';
        const valueSplit = value.split(splitBy);
        if (valueSplit.length > 1) {
          const key = valueSplit.shift()!;
          folders[key] = folders[key] || [];
          folders[key]!.push(valueSplit.join(splitBy));
        } else if (value === 'CHOOSE' || value.startsWith('DISABLE ')) {
          specialOps.push(value);
        } else {
          folderless.push(value);
        }
      }
      const foldersCount = Object.values(folders).length;
      if (foldersCount > 0) {
        const oldcallback = options.callback;
        options.callback = null;
        const newCallback = (item: ContextMenuItem, options: any) => {
          oldcallback(originalValues.find(i => i.endsWith(item!.content), options));
        };
        const [n, v] = logger.infoParts(`Nested folders found (${foldersCount}).`);
        console[n]?.(...v);
        const newValues: ContextMenuItem[] = [];
        for (const [folderName, folder] of Object.entries(folders)) {
          newValues.push({
            content: folderName,
            has_submenu: true,
            callback: () => { /* no-op */},
            submenu: {
              options: folder.map(f => ({
                content: f,
                callback: newCallback
              })),
            }
          });
        }
        values = ([] as ContextMenuItem[]).concat(specialOps.map(f => ({
          content: f,
          callback: newCallback
        })), newValues, folderless.map(f => ({
          content: f,
          callback: newCallback
        })));
      }

      return existingContextMenu.call(this as any, values, options);
    };

		LiteGraph.ContextMenu.prototype = existingContextMenu.prototype;
  },
});


