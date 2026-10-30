/**
 * @fileoverview Utilities to verify a saved lora name against the list of loras the server
 * actually has, and to find the right one when a workflow came from another machine.
 *
 * The most common breakage is moving a workflow between Linux/macOS and Windows: ComfyUI lists
 * loras in subfolders with the OS path separator ("sdxl/watercolor.safetensors" vs
 * "sdxl\\watercolor.safetensors"), so a workflow saved on one won't exactly match the other. Other
 * cases are a different file extension, a lora moved into a different subfolder, or a lora that
 * simply isn't installed.
 */

export type LoraPathStatus =
  /** The value exactly matches a lora on the server. */
  | "ok"
  /** The same file exists, but the value differs by separator, case, or extension. Safe to fix. */
  | "fixed"
  /** A single file with the same name exists in a different folder. Fixable, but worth noting. */
  | "relocated"
  /** More than one file with the same name exists in different folders; we can't choose. */
  | "ambiguous"
  /** No matching lora on the server. */
  | "missing";

export type LoraPathResult = {
  status: LoraPathStatus;
  /** The value that was checked. */
  original: string;
  /** The server's lora name to use, when one could be determined. */
  resolved: string | null;
  /** For "ambiguous", the possible matches. */
  candidates: string[];
};

/** Normalizes a lora path so names saved on different operating systems compare equally. */
export function normalizeLoraPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\/+/, "");
}

function stripExtension(path: string) {
  return path.replace(/\.[^./]+$/, "");
}

function basename(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Finds the entries in `available` whose key (computed by `keyFn` on the normalized path) equals
 * `key`. Tries a case-sensitive match first, then falls back to case-insensitive since Windows and
 * macOS file systems usually are.
 */
function findMatches(
  key: string,
  available: string[],
  normalized: string[],
  keyFn: (normalizedPath: string) => string,
) {
  let matches = available.filter((_, i) => keyFn(normalized[i]!) === key);
  if (!matches.length) {
    const lowerKey = key.toLowerCase();
    matches = available.filter((_, i) => keyFn(normalized[i]!).toLowerCase() === lowerKey);
  }
  return matches;
}

/**
 * Resolves a saved lora name against the loras the server has.
 *
 * @param lora The lora name stored in the workflow.
 * @param available The lora names as listed by the server (`folder_paths.get_filename_list`).
 */
export function resolveLoraPath(lora: string, available: string[]): LoraPathResult {
  const result = (
    status: LoraPathStatus,
    resolved: string | null,
    candidates: string[] = [],
  ): LoraPathResult => ({status, original: lora, resolved, candidates});

  if (available.includes(lora)) {
    return result("ok", lora);
  }

  const target = normalizeLoraPath(lora);
  const normalized = available.map(normalizeLoraPath);

  // Same relative path; only the separators (or case) differ.
  let matches = findMatches(target, available, normalized, (p) => p);
  if (matches.length === 1) {
    return result("fixed", matches[0]!);
  }
  if (matches.length > 1) {
    return result("ambiguous", null, matches);
  }

  // Same relative path, but a different (or no) extension. Mirrors the server's fallback.
  matches = findMatches(stripExtension(target), available, normalized, stripExtension);
  if (matches.length === 1) {
    return result("fixed", matches[0]!);
  }
  if (matches.length > 1) {
    return result("ambiguous", null, matches);
  }

  // The saved path lives inside a different parent folder (e.g. "sdxl/x" -> "styles/sdxl/x").
  if (target.includes("/")) {
    const suffix = `/${stripExtension(target)}`;
    matches = findMatches(suffix, available, normalized, (p) =>
      stripExtension(p).slice(-suffix.length),
    );
    if (matches.length === 1) {
      return result("relocated", matches[0]!);
    }
    if (matches.length > 1) {
      return result("ambiguous", null, matches);
    }
  }

  // Only the filename matches, in a different folder.
  const targetName = stripExtension(basename(target));
  matches = findMatches(targetName, available, normalized, (p) => stripExtension(basename(p)));
  if (matches.length === 1) {
    return result("relocated", matches[0]!);
  }
  if (matches.length > 1) {
    return result("ambiguous", null, matches);
  }

  return result("missing", null);
}
