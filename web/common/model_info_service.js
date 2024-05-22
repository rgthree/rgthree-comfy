import { rgthreeApi } from "./rgthree_api.js";
import { api } from "../../scripts/api.js";
class ModelInfoService extends EventTarget {
    constructor() {
        super();
        this.loraToInfo = new Map();
        api.addEventListener("rgthree-refreshed-lora-info", this.handleLoraAsyncUpdate.bind(this));
    }
    setFreshLoraData(file, info) {
        this.loraToInfo.set(file, info);
        this.dispatchEvent(new CustomEvent("rgthree-model-service-lora-details", { detail: { lora: info } }));
    }
    async getLora(file, refresh = false, light = false) {
        if (this.loraToInfo.has(file) && !refresh) {
            return this.loraToInfo.get(file);
        }
        return this.fetchLora(file, refresh, light);
    }
    async fetchLora(file, refresh = false, light = false) {
        let info = null;
        if (!refresh) {
            info = await rgthreeApi.getLorasInfo(file, light);
        }
        else {
            info = await rgthreeApi.refreshLorasInfo(file);
        }
        if (!light) {
            this.loraToInfo.set(file, info);
        }
        return info;
    }
    async refreshLora(file) {
        return this.fetchLora(file, true);
    }
    async clearLoraFetchedData(file) {
        await rgthreeApi.clearLorasInfo(file);
        this.loraToInfo.delete(file);
        return null;
    }
    async saveLoraPartial(file, data) {
        let info = await rgthreeApi.saveLoraInfo(file, data);
        this.loraToInfo.set(file, info);
        return info;
    }
    handleLoraAsyncUpdate(event) {
        var _a;
        const info = (_a = event.detail) === null || _a === void 0 ? void 0 : _a.data;
        if (info === null || info === void 0 ? void 0 : info.file) {
            this.setFreshLoraData(info.file, info);
        }
    }
}
export const SERVICE = new ModelInfoService();
