class RgthreeApi {
  private baseUrl: string;
  getCheckpointsPromise: Promise<string[]> | null = null;
  getSamplersPromise: Promise<string[]> | null = null;
  getSchedulersPromise: Promise<string[]> | null = null;
  getLorasPromise: Promise<string[]> | null = null;
  getWorkflowsPromise: Promise<string[]> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || './rgthree/api';
  }

  apiURL(route: string) {
    return `${this.baseUrl}${route}`;
  }

  fetchApi(route: string, options?: RequestInit) {
    return fetch(this.apiURL(route), options);
  }

  async fetchJson(route: string, options?: RequestInit) {
    const r = await this.fetchApi(route, options);
    return await r.json();
  }

  getLoras(force = false) {
    if (!this.getLorasPromise || force) {
      this.getLorasPromise = this.fetchJson("/loras", { cache: "no-store" });
    }
    return this.getLorasPromise;
  }
}

export const rgthreeApi = new RgthreeApi();