import type {RgthreeModelInfo} from "typings/rgthree.js";
import {rgthreeApi} from "./rgthree_api.js";
import {api} from "scripts/api.js";

/**
 * Abstract class defining information syncing for different types.
 */
abstract class BaseModelInfoService extends EventTarget {
  private readonly fileToInfo = new Map<string, RgthreeModelInfo | null>();

  protected abstract apiRefreshEventString: string;

  protected abstract apiFetchInfo(file: string, light: boolean): Promise<RgthreeModelInfo | null>;
  protected abstract apiRefreshInfo(file: string): Promise<RgthreeModelInfo | null>;
  protected abstract apiSaveInfo(
    file: string,
    data: Partial<RgthreeModelInfo>,
  ): Promise<RgthreeModelInfo | null>;
  protected abstract apiClearInfo(file: string): Promise<void>;

  constructor() {
    super();
    this.init();
  }

  private init() {
    api.addEventListener(
      this.apiRefreshEventString,
      this.handleAsyncUpdate.bind(this) as EventListener,
    );
  }

  async getInfo(file: string, refresh: boolean, light: boolean) {
    if (this.fileToInfo.has(file) && !refresh) {
      return this.fileToInfo.get(file)!;
    }
    return this.fetchInfo(file, refresh, light);
  }

  async refreshInfo(file: string) {
    return this.fetchInfo(file, true);
  }

  async clearFetchedInfo(file: string) {
    await this.apiClearInfo(file);
    // await rgthreeApi.clearLorasInfo(file);
    this.fileToInfo.delete(file);
    return null;
  }

  async savePartialInfo(file: string, data: Partial<RgthreeModelInfo>) {
    let info = await this.apiSaveInfo(file, data);
    this.fileToInfo.set(file, info);
    return info;
  }

  handleAsyncUpdate(event: CustomEvent<{data: RgthreeModelInfo}>) {
    const info = event.detail?.data as RgthreeModelInfo;
    if (info?.file) {
      this.setFreshInfo(info.file, info);
    }
  }

  private async fetchInfo(file: string, refresh = false, light = false) {
    let info = null;
    if (!refresh) {
      info = await this.apiFetchInfo(file, light);
      // info = await rgthreeApi.getLorasInfo(file, light);
    } else {
      info = await this.apiRefreshInfo(file);
      // info = await rgthreeApi.refreshLorasInfo(file);
    }
    if (!light) {
      this.fileToInfo.set(file, info);
    }
    return info;
  }

  /**
   * Single point to set data into the info cache, and fire an event. Note, this doesn't determine
   * if the data is actually different.
   */
  private setFreshInfo(file: string, info: RgthreeModelInfo) {
    this.fileToInfo.set(file, info);
    // this.dispatchEvent(
    //   new CustomEvent("rgthree-model-service-lora-details", { detail: { lora: info } }),
    // );
  }
}

/**
 * Lora type implementation of ModelInfoTypeService.
 */
class LoraInfoService extends BaseModelInfoService {
  protected apiRefreshEventString = "rgthree-refreshed-lora-info";

  protected override apiFetchInfo(file: string, light: boolean) {
    return rgthreeApi.getLorasInfo(file, light);
  }
  protected override apiRefreshInfo(file: string) {
    return rgthreeApi.refreshLorasInfo(file);
  }
  protected override apiSaveInfo(file: string, data: Partial<RgthreeModelInfo>) {
    return rgthreeApi.saveLoraInfo(file, data);
  }
  protected override apiClearInfo(file: string) {
    return rgthreeApi.clearLorasInfo(file);
  }
}


export const LORA_INFO_SERVICE = new LoraInfoService();
