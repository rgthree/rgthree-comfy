import { rgthreeApi } from "./rgthree_api.js";
import { api } from "../../scripts/api.js";
class BaseModelInfoService extends EventTarget {
    constructor() {
        super();
        this.fileToInfo = new Map();
        this.init();
    }
    init() {
        api.addEventListener(this.apiRefreshEventString, this.handleAsyncUpdate.bind(this));
    }
    async getInfo(file, refresh, light) {
        if (this.fileToInfo.has(file) && !refresh) {
            return this.fileToInfo.get(file);
        }
        return this.fetchInfo(file, refresh, light);
    }
    async refreshInfo(file) {
        return this.fetchInfo(file, true);
    }
    async clearFetchedInfo(file) {
        await this.apiClearInfo(file);
        this.fileToInfo.delete(file);
        return null;
    }
    async savePartialInfo(file, data) {
        let info = await this.apiSaveInfo(file, data);
        this.fileToInfo.set(file, info);
        return info;
    }
    handleAsyncUpdate(event) {
        var _a;
        const info = (_a = event.detail) === null || _a === void 0 ? void 0 : _a.data;
        if (info === null || info === void 0 ? void 0 : info.file) {
            this.setFreshInfo(info.file, info);
        }
    }
    async fetchInfo(file, refresh = false, light = false) {
        let info = null;
        if (!refresh) {
            info = await this.apiFetchInfo(file, light);
        }
        else {
            info = await this.apiRefreshInfo(file);
        }
        if (!light) {
            this.fileToInfo.set(file, info);
        }
        return info;
    }
    setFreshInfo(file, info) {
        this.fileToInfo.set(file, info);
    }
}
class LoraInfoService extends BaseModelInfoService {
    constructor() {
        super(...arguments);
        this.apiRefreshEventString = "rgthree-refreshed-lora-info";
    }
    apiFetchInfo(file, light) {
        return rgthreeApi.getLorasInfo(file, light);
    }
    apiRefreshInfo(file) {
        return rgthreeApi.refreshLorasInfo(file);
    }
    apiSaveInfo(file, data) {
        return rgthreeApi.saveLoraInfo(file, data);
    }
    apiClearInfo(file) {
        return rgthreeApi.clearLorasInfo(file);
    }
}
export const LORA_INFO_SERVICE = new LoraInfoService();
