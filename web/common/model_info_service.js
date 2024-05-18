import { rgthreeApi } from "./rgthree_api.js";
class ModelInfoService {
    constructor() {
        this.loraToInfo = new Map();
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
            info = await rgthreeApi.getLoraInfo(file, light);
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
}
export const SERVICE = new ModelInfoService();
