import { RgthreeModelInfo } from "typings/rgthree";

class RgthreeApi {
  private baseUrl: string;
  getCheckpointsPromise: Promise<string[]> | null = null;
  getSamplersPromise: Promise<string[]> | null = null;
  getSchedulersPromise: Promise<string[]> | null = null;
  getLorasPromise: Promise<string[]> | null = null;
  getWorkflowsPromise: Promise<string[]> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "./rgthree/api";
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

  async postJson(route: string, json: any) {
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

  async fetchApiJsonOrNull<T>(route: string, options?: RequestInit) {
    const response = await this.fetchJson(route, options);
    if (response.status === 200 && response.data) {
      return (response.data as T) || null;
    }
    return null;
  }

  /**
   * Fetches the lora information.
   *
   * @param light Whether or not to generate a json file if there isn't one. This isn't necessary if
   * we're just checking for values, but is more necessary when opening an info dialog.
   */
  async getLoraInfo(lora: string, light = true): Promise<RgthreeModelInfo | null> {
    return await this.fetchApiJsonOrNull<RgthreeModelInfo>(
      `/loras/info?file=${encodeURIComponent(lora)}&light=${light ? 1 : 0}`,
      { cache: "no-store" },
    );
  }

  async refreshLoraInfo(lora: string): Promise<RgthreeModelInfo | null> {
    return await this.fetchApiJsonOrNull<RgthreeModelInfo>(
      `/loras/info/refresh?file=${encodeURIComponent(lora)}`,
    );
  }

  async saveLoraInfo(
    lora: string,
    data: Partial<RgthreeModelInfo>,
  ): Promise<RgthreeModelInfo | null> {
    const body = new FormData();
    body.append("json", JSON.stringify(data));
    return await this.fetchApiJsonOrNull<RgthreeModelInfo>(
      `/loras/info?file=${encodeURIComponent(lora)}`,
      { cache: "no-store", method: "POST", body },
    );
  }

  async getLorasInfo(): Promise<RgthreeModelInfo[] | null> {
    return await this.fetchApiJsonOrNull<RgthreeModelInfo[]>(`/loras/info`);
  }

  async refreshLorasInfo(): Promise<RgthreeModelInfo[] | null> {
    return await this.fetchApiJsonOrNull<RgthreeModelInfo[]>(`/loras/info/refresh`);
  }
}

export const rgthreeApi = new RgthreeApi();
