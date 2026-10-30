import {resolveLoraPath} from "rgthree/common/lora_path_utils.js";
import {describe, should, expect} from "../testing/runner.js";

/** How ComfyUI on Windows lists loras in subfolders. */
const WINDOWS_LORAS = [
  "sdxl\\watercolor.safetensors",
  "sdxl\\ink.safetensors",
  "styles\\sdxl\\oil.safetensors",
  "detail.pt",
  "a\\dup.safetensors",
  "b\\dup.safetensors",
  "Root.safetensors",
];

/** How ComfyUI on Linux/macOS lists the same loras. */
const POSIX_LORAS = WINDOWS_LORAS.map((l) => l.replace(/\\/g, "/"));

describe("TestLoraPathUtils", async () => {
  await should("leave an exact match alone", async () => {
    const r = resolveLoraPath("sdxl/watercolor.safetensors", POSIX_LORAS);
    expect(r.status).toBe("status", "ok");
    expect(r.resolved).toBe("resolved", "sdxl/watercolor.safetensors");
  });

  await should("fix a Linux path loaded on Windows", async () => {
    const r = resolveLoraPath("sdxl/watercolor.safetensors", WINDOWS_LORAS);
    expect(r.status).toBe("status", "fixed");
    expect(r.resolved).toBe("resolved", "sdxl\\watercolor.safetensors");
  });

  await should("fix a Windows path loaded on Linux", async () => {
    const r = resolveLoraPath("sdxl\\watercolor.safetensors", POSIX_LORAS);
    expect(r.status).toBe("status", "fixed");
    expect(r.resolved).toBe("resolved", "sdxl/watercolor.safetensors");
  });

  await should("fix case and extension differences", async () => {
    expect(resolveLoraPath("SDXL/Watercolor.safetensors", WINDOWS_LORAS).resolved).toBe(
      "resolved",
      "sdxl\\watercolor.safetensors",
    );
    expect(resolveLoraPath("sdxl/watercolor", WINDOWS_LORAS).resolved).toBe(
      "resolved",
      "sdxl\\watercolor.safetensors",
    );
    expect(resolveLoraPath("root.safetensors", WINDOWS_LORAS).resolved).toBe(
      "resolved",
      "Root.safetensors",
    );
  });

  await should("find a lora that lives in a different folder", async () => {
    const r = resolveLoraPath("sdxl/oil.safetensors", WINDOWS_LORAS);
    expect(r.status).toBe("status", "relocated");
    expect(r.resolved).toBe("resolved", "styles\\sdxl\\oil.safetensors");
    expect(resolveLoraPath("old/detail.safetensors", WINDOWS_LORAS).resolved).toBe(
      "resolved",
      "detail.pt",
    );
  });

  await should("not guess when more than one file could match", async () => {
    const r = resolveLoraPath("dup.safetensors", WINDOWS_LORAS);
    expect(r.status).toBe("status", "ambiguous");
    expect(r.resolved).toBe("resolved", null);
    expect(r.candidates.length).toBe("candidates.length", 2);
  });

  await should("report a missing lora", async () => {
    const r = resolveLoraPath("sdxl/not_installed.safetensors", WINDOWS_LORAS);
    expect(r.status).toBe("status", "missing");
    expect(r.resolved).toBe("resolved", null);
  });
});
