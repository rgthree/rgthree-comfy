import type { RgthreeModelInfo } from "typings/rgthree.js";
import { rgthreeApi } from "./rgthree_api.js";
import { api } from "scripts/api.js";

/**
 * A singleton service to fetch and cache model infos from rgthree-comfy.
 */
class ModelInfoService extends EventTarget {
  private readonly loraToInfo = new Map<string, RgthreeModelInfo | null>();

  constructor() {
    super();
    api.addEventListener(
      "rgthree-refreshed-lora-info",
      this.handleLoraAsyncUpdate.bind(this) as EventListener,
    );
  }

  /**
   * Single point to set data into the info cache, and fire an event. Note, this doesn't determine
   * if the data is actually different.
   */
  private setFreshLoraData(file: string, info: RgthreeModelInfo) {
    this.loraToInfo.set(file, info);
    this.dispatchEvent(
      new CustomEvent("rgthree-model-service-lora-details", { detail: { lora: info } }),
    );
  }

  async getLora(file: string, refresh = false, light = false) {
    if (this.loraToInfo.has(file) && !refresh) {
      return this.loraToInfo.get(file)!;
    }
    return this.fetchLora(file, refresh, light);
  }

  async fetchLora(file: string, refresh = false, light = false) {
    let info = null;
    if (!refresh) {
      info = await rgthreeApi.getLorasInfo(file, light);
    } else {
      info = await rgthreeApi.refreshLorasInfo(file);
    }
    if (!light) {
      this.loraToInfo.set(file, info);
    }
    return info;
  }

  async refreshLora(file: string) {
    return this.fetchLora(file, true);
  }

  async clearLoraFetchedData(file: string) {
    await rgthreeApi.clearLorasInfo(file);
    this.loraToInfo.delete(file);
    return null;
  }

  async saveLoraPartial(file: string, data: Partial<RgthreeModelInfo>) {
    let info = await rgthreeApi.saveLoraInfo(file, data);
    this.loraToInfo.set(file, info);
    return info;
  }

  private handleLoraAsyncUpdate(event: CustomEvent<{ data: RgthreeModelInfo }>) {
    const info = event.detail?.data as RgthreeModelInfo;
    if (info?.file) {
      this.setFreshLoraData(info.file, info);
    }
  }
}

export const SERVICE = new ModelInfoService();
