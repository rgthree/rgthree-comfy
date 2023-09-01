import { api } from '../../scripts/api.js';
const oldApiGetNodeDefs = api.getNodeDefs;
api.getNodeDefs = async function () {
    const defs = await oldApiGetNodeDefs.call(api);
    this.dispatchEvent(new CustomEvent('fresh-node-defs', { detail: defs }));
    return defs;
};
var IoDirection;
(function (IoDirection) {
    IoDirection[IoDirection["INPUT"] = 0] = "INPUT";
    IoDirection[IoDirection["OUTPUT"] = 1] = "OUTPUT";
})(IoDirection || (IoDirection = {}));
const PADDING = 0;
export const LAYOUT_LABEL_TO_DATA = {
    'Left': [LiteGraph.LEFT, [0, 0.5], [PADDING, 0]],
    'Right': [LiteGraph.RIGHT, [1, 0.5], [-PADDING, 0]],
    'Top': [LiteGraph.UP, [0.5, 0], [0, PADDING]],
    'Bottom': [LiteGraph.DOWN, [0.5, 1], [0, -PADDING]],
};
const OPPOSITE_LABEL = {
    'Left': 'Right',
    'Right': 'Left',
    'Top': 'Bottom',
    'Bottom': 'Top',
};
export function addMenuItem(node, _app, config) {
    const oldGetExtraMenuOptions = node.prototype.getExtraMenuOptions;
    node.prototype.getExtraMenuOptions = function (canvas, menuOptions) {
        oldGetExtraMenuOptions && oldGetExtraMenuOptions.apply(this, [canvas, menuOptions]);
        const idx = menuOptions.findIndex(option => option === null || option === void 0 ? void 0 : option.content.includes('Shape')) + 1;
        menuOptions.splice((idx > 0 ? idx : menuOptions.length - 1), 0, {
            content: typeof config.name == 'function' ? config.name(this) : config.name,
            callback: (_value, _options, _event, _parentMenu, _node) => {
                if (config.property) {
                    this.properties = this.properties || {};
                    this.properties[config.property] = config.prepareValue ? config.prepareValue(this.properties[config.property], this) : !this.properties[config.property];
                }
                config.callback && config.callback(this);
            }
        });
    };
}
export function addMenuSubMenu(node, _app, config) {
    const oldGetExtraMenuOptions = node.prototype.getExtraMenuOptions;
    node.prototype.getExtraMenuOptions = function (canvas, menuOptions) {
        oldGetExtraMenuOptions && oldGetExtraMenuOptions.apply(this, [canvas, menuOptions]);
        const idx = menuOptions.findIndex(option => option === null || option === void 0 ? void 0 : option.content.includes('Shape')) + 1;
        menuOptions.splice((idx > 0 ? idx : menuOptions.length - 1), 0, {
            content: typeof config.name == 'function' ? config.name(this) : config.name,
            has_submenu: true,
            callback: (_value, _options, event, parentMenu, _node) => {
                new LiteGraph.ContextMenu(config.options.map(option => ({ content: option })), {
                    event,
                    parentMenu,
                    callback: (value, _options, _event, _parentMenu, _node) => {
                        if (config.property) {
                            this.properties = this.properties || {};
                            this.properties[config.property] = config.prepareValue ? config.prepareValue(value.content, this) : value.content;
                        }
                        config.callback && config.callback(this);
                    },
                });
            }
        });
    };
}
export function addConnectionLayoutSupport(node, app, options = [['Left', 'Right'], ['Right', 'Left']], callback) {
    addMenuSubMenu(node, app, {
        name: 'Connections Layout',
        property: 'connections_layout',
        options: options.map(option => option[0] + (option[1] ? ' -> ' + option[1] : '')),
        prepareValue: (value, node) => {
            var _a;
            const values = value.split(' -> ');
            if (!values[1] && !((_a = node.outputs) === null || _a === void 0 ? void 0 : _a.length)) {
                values[1] = OPPOSITE_LABEL[values[0]];
            }
            if (!LAYOUT_LABEL_TO_DATA[values[0]] || !LAYOUT_LABEL_TO_DATA[values[1]]) {
                throw new Error(`New Layout invalid: [${values[0]}, ${values[1]}]`);
            }
            return values;
        },
        callback: (node) => {
            callback && callback(node);
            app.graph.setDirtyCanvas(true, true);
        },
    });
    node.prototype.getConnectionPos = function (isInput, slotNumber, out) {
        return getConnectionPosForLayout(this, isInput, slotNumber, out);
    };
}
export function setConnectionsLayout(node, newLayout = ['Left', 'Right']) {
    var _a;
    if (!newLayout[1] && !((_a = node.outputs) === null || _a === void 0 ? void 0 : _a.length)) {
        newLayout[1] = OPPOSITE_LABEL[newLayout[0]];
    }
    if (!LAYOUT_LABEL_TO_DATA[newLayout[0]] || !LAYOUT_LABEL_TO_DATA[newLayout[1]]) {
        throw new Error(`New Layout invalid: [${newLayout[0]}, ${newLayout[1]}]`);
    }
    node.properties = node.properties || {};
    node.properties['connections_layout'] = newLayout;
}
export function setConnectionsCollapse(node, collapseConnections = null) {
    node.properties = node.properties || {};
    collapseConnections = collapseConnections !== null ? collapseConnections : !node.properties['collapse_connections'];
    node.properties['collapse_connections'] = collapseConnections;
}
export function getConnectionPosForLayout(node, isInput, slotNumber, out) {
    var _a, _b, _c;
    out = out || new Float32Array(2);
    node.properties = node.properties || {};
    const layout = node.properties['connections_layout'] || ['Left', 'Right'];
    const collapseConnections = node.properties['collapse_connections'] || false;
    const offset = (_a = node.constructor.layout_slot_offset) !== null && _a !== void 0 ? _a : (LiteGraph.NODE_SLOT_HEIGHT * 0.5);
    let side = isInput ? layout[0] : layout[1];
    const otherSide = isInput ? layout[1] : layout[0];
    const data = LAYOUT_LABEL_TO_DATA[side];
    const slotList = node[isInput ? 'inputs' : 'outputs'];
    const cxn = slotList[slotNumber];
    if (!cxn) {
        console.log('No connection found.. weird', isInput, slotNumber);
        return out;
    }
    if (cxn.disabled) {
        if (cxn.color_on !== '#666665') {
            cxn._color_on_org = cxn._color_on_org || cxn.color_on;
            cxn._color_off_org = cxn._color_off_org || cxn.color_off;
        }
        cxn.color_on = '#666665';
        cxn.color_off = '#666665';
    }
    else if (cxn.color_on === '#666665') {
        cxn.color_on = cxn._color_on_org || undefined;
        cxn.color_off = cxn._color_off_org || undefined;
    }
    const displaySlot = collapseConnections ? 0 : (slotNumber - slotList.reduce((count, ioput, index) => {
        count += index < slotNumber && ioput.hidden ? 1 : 0;
        return count;
    }, 0));
    cxn.dir = data[0];
    if (node.size[0] == 10 && ['Left', 'Right'].includes(side) && ['Top', 'Bottom'].includes(otherSide)) {
        side = otherSide === 'Top' ? 'Bottom' : 'Top';
    }
    else if (node.size[1] == 10 && ['Top', 'Bottom'].includes(side) && ['Left', 'Right'].includes(otherSide)) {
        side = otherSide === 'Left' ? 'Right' : 'Left';
    }
    if (side === 'Left') {
        if (node.flags.collapsed) {
            var w = node._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH;
            out[0] = node.pos[0];
            out[1] = node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT * 0.5;
        }
        else {
            if (!isInput && !cxn.has_old_label) {
                cxn.has_old_label = true;
                cxn.old_label = cxn.label;
                cxn.label = ' ';
            }
            else if (isInput && cxn.has_old_label) {
                cxn.has_old_label = false;
                cxn.label = cxn.old_label;
                cxn.old_label = undefined;
            }
            out[0] = node.pos[0] + offset;
            if ((_b = node.constructor) === null || _b === void 0 ? void 0 : _b.type.includes('Reroute')) {
                out[1] = node.pos[1] + (node.size[1] * .5);
            }
            else {
                out[1] =
                    node.pos[1] +
                        (displaySlot + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
                        (node.constructor.slot_start_y || 0);
            }
        }
    }
    else if (side === 'Right') {
        if (node.flags.collapsed) {
            var w = node._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH;
            out[0] = node.pos[0] + w;
            out[1] = node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT * 0.5;
        }
        else {
            if (isInput && !cxn.has_old_label) {
                cxn.has_old_label = true;
                cxn.old_label = cxn.label;
                cxn.label = ' ';
            }
            else if (!isInput && cxn.has_old_label) {
                cxn.has_old_label = false;
                cxn.label = cxn.old_label;
                cxn.old_label = undefined;
            }
            out[0] = node.pos[0] + node.size[0] + 1 - offset;
            if ((_c = node.constructor) === null || _c === void 0 ? void 0 : _c.type.includes('Reroute')) {
                out[1] = node.pos[1] + (node.size[1] * .5);
            }
            else {
                out[1] =
                    node.pos[1] +
                        (displaySlot + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
                        (node.constructor.slot_start_y || 0);
            }
        }
    }
    else if (side === 'Top') {
        if (!cxn.has_old_label) {
            cxn.has_old_label = true;
            cxn.old_label = cxn.label;
            cxn.label = ' ';
        }
        out[0] = node.pos[0] + (node.size[0] * .5);
        out[1] = node.pos[1] + offset;
    }
    else if (side === 'Bottom') {
        if (!cxn.has_old_label) {
            cxn.has_old_label = true;
            cxn.old_label = cxn.label;
            cxn.label = ' ';
        }
        out[0] = node.pos[0] + (node.size[0] * .5);
        out[1] = node.pos[1] + node.size[1] - offset;
    }
    return out;
}
export function wait(ms = 16, value) {
    return new Promise((resolve) => {
        setTimeout(() => { resolve(value); }, ms);
    });
}
export function addHelp(node, app) {
    const help = node.help;
    if (help) {
        addMenuItem(node, app, {
            name: '🛟 Node Help',
            property: 'help',
            callback: (_node) => { alert(help); }
        });
    }
}
export function isPassThroughType(node) {
    var _a;
    const type = (_a = node === null || node === void 0 ? void 0 : node.constructor) === null || _a === void 0 ? void 0 : _a.type;
    return (type === null || type === void 0 ? void 0 : type.includes('Reroute'))
        || (type === null || type === void 0 ? void 0 : type.includes('Node Combiner'))
        || (type === null || type === void 0 ? void 0 : type.includes('Node Collector'));
}
export function getConnectedInputNodes(app, startNode, currentNode) {
    return getConnectedNodes(app, startNode, IoDirection.INPUT, currentNode);
}
export function getConnectedOutputNodes(app, startNode, currentNode) {
    return getConnectedNodes(app, startNode, IoDirection.OUTPUT, currentNode);
}
function getConnectedNodes(app, startNode, dir = IoDirection.INPUT, currentNode) {
    var _a, _b;
    currentNode = currentNode || startNode;
    let rootNodes = [];
    const slotsToRemove = [];
    if (startNode === currentNode || isPassThroughType(currentNode)) {
        const removeDups = startNode === currentNode;
        let linkIds;
        if (dir == IoDirection.OUTPUT) {
            linkIds = (_a = currentNode.outputs) === null || _a === void 0 ? void 0 : _a.flatMap(i => i.links);
        }
        else {
            linkIds = (_b = currentNode.inputs) === null || _b === void 0 ? void 0 : _b.map(i => i.link);
        }
        let graph = app.graph;
        for (const linkId of linkIds) {
            const link = (linkId != null && graph.links[linkId]);
            if (!link) {
                continue;
            }
            const connectedId = dir == IoDirection.OUTPUT ? link.target_id : link.origin_id;
            const originNode = graph.getNodeById(connectedId);
            if (!link) {
                console.error('No connected node found... weird');
                continue;
            }
            if (isPassThroughType(originNode)) {
                for (const foundNode of getConnectedNodes(app, startNode, dir, originNode)) {
                    if (!rootNodes.includes(foundNode)) {
                        rootNodes.push(foundNode);
                    }
                }
            }
            else if (rootNodes.includes(originNode)) {
                const connectedSlot = dir == IoDirection.OUTPUT ? link.origin_slot : link.target_slot;
                removeDups && (slotsToRemove.push(connectedSlot));
            }
            else {
                rootNodes.push(originNode);
            }
        }
        for (const slot of slotsToRemove) {
            if (dir == IoDirection.OUTPUT) {
                startNode.disconnectOutput(slot);
            }
            else {
                startNode.disconnectInput(slot);
            }
        }
    }
    return rootNodes;
}
