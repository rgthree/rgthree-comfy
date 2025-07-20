import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { RgthreeBetterButtonWidget } from "./utils_widgets.js";
import { NodeTypesString } from "./constants.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { SERVICE as CONFIG_SERVICE } from "./services/config_service.js";
class RgthreePowerConductor extends RgthreeBaseVirtualNode {
    constructor(title = RgthreePowerConductor.title) {
        super(title);
        this.comfyClass = NodeTypesString.POWER_CONDUCTOR;
        this.codeWidget = ComfyWidgets.STRING(this, "", ["STRING", { multiline: true }], app).widget;
        this.addCustomWidget(this.codeWidget);
        (this.buttonWidget = new RgthreeBetterButtonWidget("Run", (...args) => {
            this.execute();
        })),
            this.addCustomWidget(this.buttonWidget);
        this.onConstructed();
    }
    execute() {
        const executor = new Executor();
        executor.execute(this.codeWidget.value);
    }
}
RgthreePowerConductor.title = NodeTypesString.POWER_CONDUCTOR;
RgthreePowerConductor.type = NodeTypesString.POWER_CONDUCTOR;
const NODE_CLASS = RgthreePowerConductor;
let parser = null;
async function getParser() {
    if (parser) {
        return parser;
    }
    const TreeSitter = (await import("../../rgthree/lib/tree-sitter.js"));
    await TreeSitter.Parser.init();
    const lang = await TreeSitter.Language.load("rgthree/lib/tree-sitter-python.wasm");
    parser = new TreeSitter.Parser();
    parser.setLanguage(lang);
    return parser;
}
async function parse(code) {
    parser = await getParser();
    return parser.parse(code);
}
function check(value, msg = "") {
    if (!value) {
        throw new Error(msg || "Error");
    }
}
class PyTuple {
    constructor(...args) {
        if (args.length === 1 && args[0] instanceof PyTuple) {
            args = args[0].__unwrap__();
        }
        this.list = [...args];
    }
    count(v) {
    }
    index() {
    }
    __unwrap__() {
        var _a;
        const l = [...this.list];
        for (let i = 0; i < l.length; i++) {
            l[i] = ((_a = l[i]) === null || _a === void 0 ? void 0 : _a.__unwrap__) ? l[i].__unwrap__() : l[i];
        }
        return l;
    }
    __len__() {
        return this.list.length;
    }
    __add__(v) {
        if (!(v instanceof PyTuple)) {
            throw new Error("Can only concatenate tuple to tuple.");
        }
        return new PyTuple(this.__unwrap__().concat(v.__unwrap__()));
    }
}
class PyList extends PyTuple {
    append(...args) {
        this.list.push(...args);
    }
    clear() {
        this.list.length = 0;
    }
    insert() {
    }
    pop() {
    }
    remove() {
    }
    reverse() {
    }
    sort() {
    }
    __add__(v) {
        if (!(v instanceof PyList)) {
            throw new Error("Can only concatenate list to list.");
        }
        return new PyList(this.__unwrap__().concat(v.__unwrap__()));
    }
}
class PyInt {
}
function __unwrap__(...args) {
    var _a;
    for (let i = 0; i < args.length; i++) {
        args[i] = ((_a = args[i]) === null || _a === void 0 ? void 0 : _a.__unwrap__) ? args[i].__unwrap__() : args[i];
    }
    return args;
}
const BUILT_INS = new Map([
    ["round", (n) => Math.round(Number(n))],
    ["floor", (n) => Math.floor(Number(n))],
    ["ceil", (n) => Math.ceil(Number(n))],
    ["len", (n) => { var _a, _b; return (_a = n === null || n === void 0 ? void 0 : n.length) !== null && _a !== void 0 ? _a : (_b = n === null || n === void 0 ? void 0 : n.__len__) === null || _b === void 0 ? void 0 : _b.call(n); }],
    ["print", (...args) => console.log(...__unwrap__(...args))],
    ["log", (...args) => console.log(...__unwrap__(...args))],
    ["int", (n) => Math.floor(Number(n))],
    ["float", Number],
    ["list", (...args) => new PyList(...args)],
    ["tuple", (...args) => new PyTuple([...args])],
]);
class SimpleNode {
    constructor(node) {
        this.type = node.type;
        this.text = node.text;
        if (this.type === "ERROR") {
            throw new Error(`Error found in parsing near "${this.text}"`);
        }
        this.children = [];
        for (const child of node.children) {
            this.children.push(new SimpleNode(child));
        }
        this.node = node;
    }
    child(index) {
        const child = this.children[index];
        if (!child)
            throw Error(`No child at index ${index}.`);
        return child;
    }
    log(tab = "", showNode = false) {
        console.log(`${tab}--- SimpleNode`);
        console.log(`${tab} type: ${this.type}`);
        console.log(`${tab} text: ${this.text}`);
        console.log(`${tab} children:`, this.children);
        if (showNode) {
            console.log(`${tab} node:`, this.node);
        }
    }
}
class Executor {
    constructor(ctx = null) {
        this.typeToHandler = new Map([
            ["module", this.handleChildren.bind(this)],
            ["expression_statement", this.handleChildren.bind(this)],
            ["comment", this.handleSwallow.bind(this)],
            ["return_statement", this.handleReturn.bind(this)],
            ["assignment", this.handleAssignment.bind(this)],
            ["named_expression", this.handleNamedExpression.bind(this)],
            ["identifier", this.handleIdentifier.bind(this)],
            ["attribute", this.handleAttribute.bind(this)],
            ["call", this.handleCall.bind(this)],
            ["argument_list", this.handleArgumentsList.bind(this)],
            ["list_comprehension", this.handleListComprehension.bind(this)],
            ["comparison_operator", this.handleComparisonOperator.bind(this)],
            ["boolean_operator", this.handleBooleanOperator.bind(this)],
            ["not_operator", this.handleNotOperator.bind(this)],
            ["binary_operator", this.handleBinaryOperator.bind(this)],
            ["integer", this.handleNumber.bind(this)],
            ["float", this.handleNumber.bind(this)],
            ["string", this.handleString.bind(this)],
            ["tuple", this.handleList.bind(this)],
            ["list", this.handleList.bind(this)],
            ["dictionary", this.handleDictionary.bind(this)],
            ["pair", this.handleDictionaryPair.bind(this)],
        ]);
        this.ctx = {};
        this.ctxInitial = {};
        this.isEvaluating = false;
        this.ctxInitial = ctx || {};
    }
    async execute(code) {
        var _a, _b;
        if (this.isEvaluating) {
            console.log("Already executing...");
            return;
        }
        this.isEvaluating = true;
        const root = (await parse(code)).rootNode;
        this.ctx = !!window.structuredClone ? structuredClone(this.ctxInitial) : { ...this.ctxInitial };
        const value = await this.handleNode(new SimpleNode(root), this.ctx);
        console.log("=====");
        console.log(`value`, (_b = (_a = value === null || value === void 0 ? void 0 : value.__unwrap__) === null || _a === void 0 ? void 0 : _a.call(value)) !== null && _b !== void 0 ? _b : value);
        console.log("context", this.ctx);
    }
    async handleNode(node, ctx, tab = "") {
        var _a, _b;
        const type = node.type;
        if (ctx.hasOwnProperty("__returned__"))
            return ctx["__returned__"];
        console.log(`${tab}-----`);
        console.log(`${tab}eval_node`);
        console.log(`${tab}type: ${type}`);
        console.log(`${tab}text: ${node.text}`);
        console.log(`${tab}children: ${(_b = (_a = node.children) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0}`);
        console.log(ctx);
        console.log(node);
        const handler = this.typeToHandler.get(type);
        check(handler, "Unhandled type: " + type);
        return handler(node, ctx, tab);
    }
    async handleSwallow(node, ctx = this.ctx, tab = "") {
    }
    async handleReturn(node, ctx = this.ctx, tab = "") {
        const value = node.children.length > 1 ? this.handleNode(node.child(1), ctx, tab) : undefined;
        ctx["__returned__"] = value;
        return value;
    }
    async handleChildren(node, ctx = this.ctx, tab = "") {
        let lastValue = null;
        for (const child of node.children) {
            if (!child)
                continue;
            lastValue = await this.handleNode(child, ctx, tab + "  ");
        }
        return lastValue;
    }
    async handleIdentifier(node, ctx = this.ctx, tab = "") {
        let value = ctx[node.text];
        if (!value) {
            value = BUILT_INS.get(node.text);
        }
        return value;
    }
    async handleAttribute(node, ctx = this.ctx, tab = "") {
        var _a;
        check(node.children.length === 3, "Expected 3 children for attr, identifier/attr, period, and identifier.");
        const inst = await this.handleNode(node.child(0), ctx, tab);
        check(((_a = node.child(1)) === null || _a === void 0 ? void 0 : _a.text) === ".", "Expected period separating parts of attribute.");
        const attr = node.child(2).text;
        check(!attr.startsWith("__") && !attr.endsWith("__"), `"${attr}" is not accessible.`);
        let attribute = inst[attr];
        check(attribute !== undefined, `"${attr}" not found on instance of type ${typeof inst}.`);
        return typeof attribute === "function" ? attribute.bind(inst) : attribute;
    }
    async handleAssignment(node, ctx, tab = "") {
        const vars = [];
        let value = null;
        for (const child of node.children) {
            if (!child)
                continue;
            if (child.type === "identifier") {
                vars.push(child.text);
            }
            else if (child.type === "=") {
                continue;
            }
            else {
                value = await this.handleNode(child, ctx, tab + "  ");
            }
        }
        check(vars.length, "No vars for assignment");
        check(vars.length === 1, "Not yet handling multiple vars");
        ctx[vars[0]] = value;
        return value;
    }
    async handleNamedExpression(node, ctx, tab = "") {
        check(node.children.length === 3, "Expected three children for named expression.");
        check(node.child(0).type === "identifier", "Expected identifier first in named expression.");
        const varName = node.child(0).text;
        ctx[varName] = await this.handleNode(node.child(2), ctx, tab);
        return ctx[varName];
    }
    async handleCall(node, ctx, tab = "") {
        check(node.children.length === 2, "Expected 2 children for call, identifier and arguments.");
        const fn = await this.handleNode(node.children[0], ctx, tab);
        const args = await this.handleNode(node.children[1], ctx, tab);
        console.log("handleCall", fn, args);
        return fn(...args);
    }
    async handleArgumentsList(node, ctx, tab = "") {
        return [(await this.handleList(node, ctx, tab)).__unwrap__()];
    }
    async handleListComprehension(node, ctx, tab = "") {
        const finalList = new PyList();
        const newCtx = { ...ctx };
        let finalEntryNode;
        const loopNodes = [];
        for (const child of node.children) {
            if (!child || ["[", "]"].includes(child.type))
                continue;
            if (child.type === "identifier" || child.type === "attribute") {
                if (finalEntryNode) {
                    throw Error("Already have a list comprehension finalEntryNode.");
                }
                finalEntryNode = child;
            }
            else if (child.type === "for_in_clause") {
                loopNodes.push({ forIn: child });
            }
            else if (child.type === "if_clause") {
                loopNodes[loopNodes.length - 1]["if"] = child;
            }
        }
        if (!finalEntryNode) {
            throw Error("No list comprehension finalEntryNode.");
        }
        console.log(`${tab}handleListComprehension.loopNodes`, loopNodes);
        const handleLoop = async (loopNodes) => {
            const loopNode = loopNodes.shift();
            console.log(`${tab}handleLoop`, loopNode);
            const identifierNode = loopNode.forIn.child(1);
            check(identifierNode.type === "identifier");
            const loopId = identifierNode.text;
            const iterable = (await this.handleNode(loopNode.forIn.child(3), newCtx, tab)).__unwrap__();
            console.log(`${tab}handleLoop.iterable`, iterable);
            for (const item of iterable) {
                const ifCtx = { ...newCtx };
                ifCtx[loopId] = item;
                if (loopNode.if) {
                    const ifNode = loopNode.if;
                    check(ifNode.children.length === 2, "Expected 2 children for if_clause.");
                    check(ifNode.child(0).text === "if", "Expected first child to be 'if'.");
                    const good = await this.handleNode(ifNode.child(1), ifCtx, tab);
                    if (!good)
                        continue;
                }
                Object.assign(newCtx, ifCtx);
                if (loopNodes.length) {
                    await handleLoop(loopNodes);
                }
                else {
                    finalList.append(await this.handleNode(finalEntryNode, newCtx, tab));
                }
            }
            loopNodes.unshift(loopNode);
        };
        await handleLoop(loopNodes);
        return finalList;
    }
    async handleNumber(node, ctx = this.ctx, tab = "") {
        return Number(node.text);
    }
    async handleString(node, ctx = this.ctx, tab = "") {
        check(node.children.length === 3, "Expected 3 children for str (quotes and value).");
        return String(node.child(1).text);
    }
    async handleList(node, ctx = this.ctx, tab = "") {
        const list = [];
        for (const child of node.children) {
            if (!child || ["(", "[", ",", "]", ")"].includes(child.type))
                continue;
            list.push(await this.handleNode(child, ctx, tab + "  "));
        }
        if (node.type === "tuple") {
            return new PyTuple(...list);
        }
        return new PyList(...list);
    }
    async handleComparisonOperator(node, ctx = this.ctx, tab = "") {
        const op = node.child(1).text;
        const left = await this.handleNode(node.child(0), ctx, tab);
        const right = await this.handleNode(node.child(2), ctx, tab);
        if (op === "==")
            return left === right;
        if (op === "!=")
            return left !== right;
        if (op === ">")
            return left > right;
        if (op === ">=")
            return left >= right;
        if (op === "<")
            return left < right;
        if (op === "<=")
            return left <= right;
        if (op === "in")
            return (right.__unwrap__ ? right.__unwrap__() : right).includes(left);
        throw new Error(`Comparison not handled: "${op}"`);
    }
    async handleBooleanOperator(node, ctx = this.ctx, tab = "") {
        const op = node.child(1).text;
        const left = await this.handleNode(node.child(0), ctx, tab);
        if (!left && op === "or")
            return left;
        const right = await this.handleNode(node.child(2), ctx, tab);
        if (op === "and")
            return left && right;
        if (op === "or")
            return left || right;
    }
    async handleNotOperator(node, ctx = this.ctx, tab = "") {
        check(node.children.length === 2, "Expected 2 children for not operator.");
        check(node.child(0).text === "not", "Expected first child to be 'not'.");
        const value = await this.handleNode(node.child(1), ctx, tab);
        return !value;
    }
    async handleBinaryOperator(node, ctx = this.ctx, tab = "") {
        const op = node.child(1).text;
        const left = await this.handleNode(node.child(0), ctx, tab);
        const right = await this.handleNode(node.child(2), ctx, tab);
        if (left.constructor !== right.constructor) {
            throw new Error(`Can only run ${op} operator on same type.`);
        }
        if (op === "+")
            return left.__add__ ? left.__add__(right) : left + right;
        if (op === "-")
            return left - right;
        if (op === "/")
            return left / right;
        if (op === "//")
            return Math.floor(left / right);
        if (op === "*")
            return left * right;
        if (op === "%")
            return left % right;
        if (op === "&")
            return left & right;
        if (op === "|")
            return left | right;
        if (op === "^")
            return left ^ right;
        if (op === "<<")
            return left << right;
        if (op === ">>")
            return left >> right;
        throw new Error(`Comparison not handled: "${op}"`);
    }
    async handleDictionary(node, ctx = this.ctx, tab = "") {
        const dict = {};
        for (const child of node.children) {
            if (!child || ["{", "}"].includes(child.type))
                continue;
            const pair = await this.handleNode(child, ctx, tab + "  ");
            Object.assign(dict, pair);
        }
        return dict;
    }
    async handleDictionaryPair(node, ctx = this.ctx, tab = "") {
        check(node.children.length === 3, "Expected 3 children for dict pair.");
        let varName = await this.handleNode(node.child(0), ctx, tab + "  ");
        let varValue = await this.handleNode(node.child(2), ctx, tab + "  ");
        check(typeof varName === "string", "Expected varname to be string.");
        return { [varName]: varValue };
    }
}
app.registerExtension({
    name: "rgthree.PowerConductor",
    registerCustomNodes() {
        if (CONFIG_SERVICE.getConfigValue("unreleased.power_conductor.enabled")) {
            NODE_CLASS.setUp();
        }
    },
});
