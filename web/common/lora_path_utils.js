export function normalizeLoraPath(path) {
    return path
        .replace(/\\/g, "/")
        .replace(/\/{2,}/g, "/")
        .replace(/^(\.\/)+/, "")
        .replace(/^\/+/, "");
}
function stripExtension(path) {
    return path.replace(/\.[^./]+$/, "");
}
function basename(path) {
    return path.slice(path.lastIndexOf("/") + 1);
}
function findMatches(key, available, normalized, keyFn) {
    let matches = available.filter((_, i) => keyFn(normalized[i]) === key);
    if (!matches.length) {
        const lowerKey = key.toLowerCase();
        matches = available.filter((_, i) => keyFn(normalized[i]).toLowerCase() === lowerKey);
    }
    return matches;
}
export function resolveLoraPath(lora, available) {
    const result = (status, resolved, candidates = []) => ({ status, original: lora, resolved, candidates });
    if (available.includes(lora)) {
        return result("ok", lora);
    }
    const target = normalizeLoraPath(lora);
    const normalized = available.map(normalizeLoraPath);
    let matches = findMatches(target, available, normalized, (p) => p);
    if (matches.length === 1) {
        return result("fixed", matches[0]);
    }
    if (matches.length > 1) {
        return result("ambiguous", null, matches);
    }
    matches = findMatches(stripExtension(target), available, normalized, stripExtension);
    if (matches.length === 1) {
        return result("fixed", matches[0]);
    }
    if (matches.length > 1) {
        return result("ambiguous", null, matches);
    }
    if (target.includes("/")) {
        const suffix = `/${stripExtension(target)}`;
        matches = findMatches(suffix, available, normalized, (p) => stripExtension(p).slice(-suffix.length));
        if (matches.length === 1) {
            return result("relocated", matches[0]);
        }
        if (matches.length > 1) {
            return result("ambiguous", null, matches);
        }
    }
    const targetName = stripExtension(basename(target));
    matches = findMatches(targetName, available, normalized, (p) => stripExtension(basename(p)));
    if (matches.length === 1) {
        return result("relocated", matches[0]);
    }
    if (matches.length > 1) {
        return result("ambiguous", null, matches);
    }
    return result("missing", null);
}
