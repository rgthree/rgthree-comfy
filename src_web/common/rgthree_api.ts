import type { RgthreeModelInfo } from "typings/rgthree.js";

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
  async getLorasInfo(lora: string, light?: boolean): Promise<RgthreeModelInfo | null>;
  async getLorasInfo(light?: boolean): Promise<RgthreeModelInfo[] | null>;
  async getLorasInfo(...args: any) {
    const params = new URLSearchParams();
    const isSingleLora = typeof args[0] == 'string';
    if (isSingleLora) {
      params.set("file", args[0]);
    }
    params.set("light", (isSingleLora ? args[1] : args[0]) === false ? '0' : '1');
    const path = `/loras/info?` + params.toString();
    return await this.fetchApiJsonOrNull<RgthreeModelInfo[]|RgthreeModelInfo>(path);
  }

  async refreshLorasInfo(file: string): Promise<RgthreeModelInfo | null>;
  async refreshLorasInfo(): Promise<RgthreeModelInfo[] | null>;
  async refreshLorasInfo(file?: string) {
    const path = `/loras/info/refresh` + (file ? `?file=${encodeURIComponent(file)}` : '');
    const infos = await this.fetchApiJsonOrNull<RgthreeModelInfo[]|RgthreeModelInfo>(path);
    return infos;
  }

  async clearLorasInfo(file?: string): Promise<void> {
    const path = `/loras/info/clear` + (file ? `?file=${encodeURIComponent(file)}` : '');
    await this.fetchApiJsonOrNull<RgthreeModelInfo[]>(path);
    return;
  }

  /**
   * Saves partial data sending it to the backend..
   */
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

}

export const rgthreeApi = new RgthreeApi();
