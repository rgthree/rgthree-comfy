export function sortBy(items, options) {
    const { sort } = options;
    if (sort === "position") {
        return sortByPosition(items);
    }
    const { customAlphabet: customAlphaStr } = options;
    if (!customAlphaStr || sort === "alphanumeric") {
        return [...items].sort((a, b) => a.title.localeCompare(b.title));
    }
    let customAlphabet = customAlphaStr.includes(",")
        ? customAlphaStr.toLocaleLowerCase().split(",")
        : customAlphaStr.toLocaleLowerCase().trim().split("");
    if (!customAlphabet.length) {
        return items;
    }
    items.sort((a, b) => {
        let aIndex = -1;
        let bIndex = -1;
        for (const [index, alpha] of customAlphabet.entries()) {
            aIndex = aIndex < 0 ? (a.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : aIndex;
            bIndex = bIndex < 0 ? (b.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : bIndex;
            if (aIndex > -1 && bIndex > -1) {
                break;
            }
        }
        if (aIndex > -1 && bIndex > -1) {
            const ret = aIndex - bIndex;
            if (ret !== 0) {
                return ret;
            }
            return a.title.localeCompare(b.title);
        }
        if (aIndex > -1) {
            return -1;
        }
        if (bIndex > -1) {
            return 1;
        }
        return a.title.localeCompare(b.title);
    });
    return items;
}
function sortByPosition(items) {
    return items.sort((a, b) => {
        const aY = Math.floor(a.pos[1] / 30);
        const bY = Math.floor(b.pos[1] / 30);
        if (aY != bY) {
            return aY - bY;
        }
        const aX = Math.floor(a.pos[0] / 30);
        const bX = Math.floor(b.pos[0] / 30);
        return aX - bX;
    });
}
function normalizeColor(color) {
    const trimmed = color.replace("#", "").trim().toLocaleLowerCase();
    const fullHex = trimmed.length === 3 ? trimmed.replace(/(.)(.)(.)/, "$1$1$2$2$3$3") : trimmed;
    return `#${fullHex}`;
}
export function filterByColor(items, options = { nodeColorOption: "groupcolor" }) {
    var _a;
    const { matchColors, nodeColorOption } = options;
    if (!matchColors) {
        return items;
    }
    const filterColors = ((_a = matchColors.split(",")) !== null && _a !== void 0 ? _a : [])
        .filter((c) => c.trim())
        .map((color) => color.trim().toLocaleLowerCase())
        .map((color) => { var _a, _b; return (_b = (_a = LGraphCanvas.node_colors[color]) === null || _a === void 0 ? void 0 : _a[nodeColorOption]) !== null && _b !== void 0 ? _b : color; })
        .map((color) => normalizeColor(color));
    if (!filterColors.length) {
        return items;
    }
    return items.filter((item) => {
        if (!item.color) {
            return false;
        }
        let color = normalizeColor(item.color);
        return filterColors.includes(color);
    });
}
export function filterByTitle(items, options = {}) {
    const { matchTitle } = options;
    if (!matchTitle) {
        return items;
    }
    const matchPattern = new RegExp(matchTitle, "i");
    return items.filter((item) => {
        try {
            return matchPattern.exec(item.title);
        }
        catch (e) {
            console.error(e);
        }
        return true;
    });
}
export function groupHasActiveNode(group) {
    group._rgthreeHasAnyActiveNode = group._nodes.some((n) => n.mode === LiteGraph.ALWAYS);
    return group._rgthreeHasAnyActiveNode;
}
