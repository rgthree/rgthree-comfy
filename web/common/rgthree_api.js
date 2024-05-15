class RgthreeApi {
    constructor(baseUrl) {
        this.getCheckpointsPromise = null;
        this.getSamplersPromise = null;
        this.getSchedulersPromise = null;
        this.getLorasPromise = null;
        this.getWorkflowsPromise = null;
        this.baseUrl = baseUrl || "./rgthree/api";
    }
    apiURL(route) {
        return `${this.baseUrl}${route}`;
    }
    fetchApi(route, options) {
        return fetch(this.apiURL(route), options);
    }
    async fetchJson(route, options) {
        const r = await this.fetchApi(route, options);
        return await r.json();
    }
    async postJson(route, json) {
        const body = new FormData();
        body.append("json", JSON.stringify(json));
        return await rgthreeApi.fetchJson(route, { method: "POST", body });
    }
    getLoras(force = false) {
        if (!this.getLorasPromise || force) {
            this.getLorasPromise = this.fetchJson("/loras", { cache: "no-store" });
        }
        return this.getLorasPromise;
    }
    async fetchApiJsonOrNull(route, options) {
        const response = await this.fetchJson(route, options);
        if (response.status === 200 && response.data) {
            return response.data || null;
        }
        return null;
    }
    async getLoraInfo(lora, light = true) {
        return await this.fetchApiJsonOrNull(`/loras/info?file=${encodeURIComponent(lora)}&light=${light ? 1 : 0}`, { cache: "no-store" });
    }
    async refreshLoraInfo(lora) {
        return await this.fetchApiJsonOrNull(`/loras/info/refresh?file=${encodeURIComponent(lora)}`);
    }
    async saveLoraInfo(lora, data) {
        const body = new FormData();
        body.append("json", JSON.stringify(data));
        return await this.fetchApiJsonOrNull(`/loras/info?file=${encodeURIComponent(lora)}`, { cache: "no-store", method: "POST", body });
    }
    async getLorasInfo() {
        return await this.fetchApiJsonOrNull(`/loras/info`);
    }
    async refreshLorasInfo() {
        return await this.fetchApiJsonOrNull(`/loras/info/refresh`);
    }
}
export const rgthreeApi = new RgthreeApi();
