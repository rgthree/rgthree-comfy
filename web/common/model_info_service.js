import { rgthreeApi } from "./rgthree_api.js";
class ModelInfoService {
    constructor() {
        this.loraToInfo = new Map();
    }
    async getLora(file, refresh = false) {
        if (this.loraToInfo.has(file) && !refresh) {
            return this.loraToInfo.get(file);
        }
        return this.fetchLora(file, refresh);
    }
    async fetchLora(file, refresh = false) {
        let info = null;
        if (!refresh) {
            info = await rgthreeApi.getLoraInfo(file);
        }
        else {
            info = await rgthreeApi.refreshLoraInfo(file);
        }
        this.loraToInfo.set(file, info);
        return info;
    }
    async refreshLora(file) {
        return this.fetchLora(file, true);
    }
}
export const SERVICE = new ModelInfoService();
