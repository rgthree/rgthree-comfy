import { RgthreeModelInfo } from "typings/rgthree";
import { rgthreeApi } from "./rgthree_api.js";

/**
 * A singleton service to fetch and cache model infos from rgthree-comfy.
 */
class ModelInfoService {
  private readonly loraToInfo = new Map<string, RgthreeModelInfo | null>();

  async getLora(file: string, refresh = false) {
    if (this.loraToInfo.has(file) && !refresh) {
      return this.loraToInfo.get(file)!;
    }
    return this.fetchLora(file, refresh);
  }

  async fetchLora(file: string, refresh = false) {
    let info = null;
    if (!refresh) {
      info = await rgthreeApi.getLoraInfo(file);
    } else {
      info = await rgthreeApi.refreshLoraInfo(file);
    }
    this.loraToInfo.set(file, info);
    return info;
  }

  async refreshLora(file: string) {
    return this.fetchLora(file, true);
  }
}

export const SERVICE = new ModelInfoService();
