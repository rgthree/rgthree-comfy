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
    async getLorasInfo(...args) {
        return this.getModelInfo("loras", ...args);
    }
    async refreshLorasInfo(file) {
        return this.refreshModelInfo("loras", file);
    }
    async clearLorasInfo(file) {
        return this.clearModelInfo("loras", file);
    }
    async saveLoraInfo(file, data) {
        return this.saveModelInfo("loras", file, data);
    }
    async getModelInfo(type, ...args) {
        const params = new URLSearchParams();
        const isSingle = typeof args[0] == "string";
        if (isSingle) {
            params.set("file", args[0]);
        }
        params.set("light", (isSingle ? args[1] : args[0]) === false ? "0" : "1");
        const path = `/${type}/info?` + params.toString();
        return await this.fetchApiJsonOrNull(path);
    }
    async refreshModelInfo(type, file) {
        const path = `/${type}/info/refresh` + (file ? `?file=${encodeURIComponent(file)}` : "");
        const infos = await this.fetchApiJsonOrNull(path);
        return infos;
    }
    async clearModelInfo(type, file) {
        const path = `/${type}/info/clear` + (file ? `?file=${encodeURIComponent(file)}` : "");
        await this.fetchApiJsonOrNull(path);
        return;
    }
    async saveModelInfo(type, file, data) {
        const body = new FormData();
        body.append("json", JSON.stringify(data));
        return await this.fetchApiJsonOrNull(`/${type}/info?file=${encodeURIComponent(file)}`, { cache: "no-store", method: "POST", body });
    }
}
export const rgthreeApi = new RgthreeApi();
