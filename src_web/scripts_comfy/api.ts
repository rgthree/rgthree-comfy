interface ComfyApi extends EventTarget {
  getNodeDefs(): any;
  apiURL(url: string): string;
  queuePrompt(num: number, data: { output: {}; workflow: {} }): Promise<{}>;
}

export declare const api: ComfyApi;
