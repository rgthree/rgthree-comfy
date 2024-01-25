class RgthreeApi {
    constructor(baseUrl) {
        this.getCheckpointsPromise = null;
        this.getSamplersPromise = null;
        this.getSchedulersPromise = null;
        this.getLorasPromise = null;
        this.getWorkflowsPromise = null;
        this.baseUrl = baseUrl || './rgthree/api';
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
}
export const rgthreeApi = new RgthreeApi();
