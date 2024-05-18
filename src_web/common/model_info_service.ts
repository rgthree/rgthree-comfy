import { RgthreeModelInfo } from "typings/rgthree";
import { rgthreeApi } from "./rgthree_api.js";

/**
 * A singleton service to fetch and cache model infos from rgthree-comfy.
 */
class ModelInfoService {
  private readonly loraToInfo = new Map<string, RgthreeModelInfo | null>();

  async getLora(file: string, refresh = false, light = false) {
    if (this.loraToInfo.has(file) && !refresh) {
      return this.loraToInfo.get(file)!;
    }
    return this.fetchLora(file, refresh, light);
  }

  async fetchLora(file: string, refresh = false, light = false) {
    let info = null;
    if (!refresh) {
      info = await rgthreeApi.getLoraInfo(file, light);
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
}

export const SERVICE = new ModelInfoService();
