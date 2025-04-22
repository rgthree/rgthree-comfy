import type {RgthreeModelInfo} from "typings/rgthree.js";

type ModelInfoType = "loras";

class RgthreeApi {
  private baseUrl: string;
  private comfyBaseUrl: string;
  getCheckpointsPromise: Promise<string[]> | null = null;
  getSamplersPromise: Promise<string[]> | null = null;
  getSchedulersPromise: Promise<string[]> | null = null;
  getLorasPromise: Promise<string[]> | null = null;
  getWorkflowsPromise: Promise<string[]> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "./rgthree/api";

    // Calculate the comfyUI api base path by checkin gif we're on an rgthree independant page (as
    // we'll always use '/rgthree/' prefix) and, if so, assume the path before `/rgthree/` is the
    // base path. If we're not, then just use the same pathname logic as the ComfyUI api.js uses.
    const comfyBasePathname = location.pathname.includes("/rgthree/")
      ? location.pathname.split("rgthree/")[0]!
      : location.pathname;
    this.comfyBaseUrl = comfyBasePathname.split("/").slice(0, -1).join("/");
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
    return await rgthreeApi.fetchJson(route, {method: "POST", body});
  }

  getLoras(force = false) {
    if (!this.getLorasPromise || force) {
      this.getLorasPromise = this.fetchJson("/loras", {cache: "no-store"});
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
    return this.getModelInfo("loras", ...args);
  }

  async refreshLorasInfo(file: string): Promise<RgthreeModelInfo | null>;
  async refreshLorasInfo(): Promise<RgthreeModelInfo[] | null>;
  async refreshLorasInfo(file?: string) {
    return this.refreshModelInfo("loras", file);
  }

  async clearLorasInfo(file?: string): Promise<void> {
    return this.clearModelInfo("loras", file);
  }

  /**
   * Saves partial data sending it to the backend..
   */
  async saveLoraInfo(
    file: string,
    data: Partial<RgthreeModelInfo>,
  ): Promise<RgthreeModelInfo | null> {
    return this.saveModelInfo("loras", file, data);
  }

  private async getModelInfo(type: ModelInfoType, ...args: any) {
    const params = new URLSearchParams();
    const isSingle = typeof args[0] == "string";
    if (isSingle) {
      params.set("file", args[0]);
    }
    params.set("light", (isSingle ? args[1] : args[0]) === false ? "0" : "1");
    const path = `/${type}/info?` + params.toString();
    return await this.fetchApiJsonOrNull<RgthreeModelInfo[] | RgthreeModelInfo>(path);
  }

  private async refreshModelInfo(type: ModelInfoType, file?: string) {
    const path = `/${type}/info/refresh` + (file ? `?file=${encodeURIComponent(file)}` : "");
    const infos = await this.fetchApiJsonOrNull<RgthreeModelInfo[] | RgthreeModelInfo>(path);
    return infos;
  }

  private async clearModelInfo(type: ModelInfoType, file?: string) {
    const path = `/${type}/info/clear` + (file ? `?file=${encodeURIComponent(file)}` : "");
    await this.fetchApiJsonOrNull<RgthreeModelInfo[]>(path);
    return;
  }

  private async saveModelInfo(
    type: ModelInfoType,
    file: string,
    data: Partial<RgthreeModelInfo>,
  ): Promise<RgthreeModelInfo | null> {
    const body = new FormData();
    body.append("json", JSON.stringify(data));
    return await this.fetchApiJsonOrNull<RgthreeModelInfo>(
      `/${type}/info?file=${encodeURIComponent(file)}`,
      {cache: "no-store", method: "POST", body},
    );
  }

  /**
   * [🤮] Fetches from the ComfyUI given a similar functionality to the real ComfyUI API
   * implementation, but can be available on independant pages outside of the ComfyUI UI. This is
   * because ComfyUI frontend stopped serving its modules independantly and opted for a giant bundle
   * instead which no longer allows us to load its `api.js` file separately.
   */
  fetchComfyApi(route: string, options?: any): Promise<any> {
    const url = this.comfyBaseUrl + "/api" + route;
    options = options || {};
    options.headers = options.headers || {};
    options.cache = options.cache || "no-cache";
    return fetch(url, options);
  }
}

export const rgthreeApi = new RgthreeApi();
