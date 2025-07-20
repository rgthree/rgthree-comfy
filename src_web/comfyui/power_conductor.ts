import type {Parser, Node, Tree} from "web-tree-sitter";
import type {IStringWidget} from "@comfyorg/litegraph/dist/types/widgets";

import {app} from "scripts/app.js";
import {RgthreeBaseVirtualNode} from "./base_node.js";
import {RgthreeBetterButtonWidget} from "./utils_widgets.js";
import {NodeTypesString} from "./constants.js";
import {ComfyWidgets} from "scripts/widgets.js";
import {SERVICE as CONFIG_SERVICE} from "./services/config_service.js";

class RgthreePowerConductor extends RgthreeBaseVirtualNode {
  static override title = NodeTypesString.POWER_CONDUCTOR;
  static override type = NodeTypesString.POWER_CONDUCTOR;
  override comfyClass = NodeTypesString.POWER_CONDUCTOR;

  private codeWidget: IStringWidget;
  private buttonWidget: RgthreeBetterButtonWidget;

  constructor(title = RgthreePowerConductor.title) {
    super(title);

    this.codeWidget = ComfyWidgets.STRING(this, "", ["STRING", {multiline: true}], app).widget;
    this.addCustomWidget(this.codeWidget);

    (this.buttonWidget = new RgthreeBetterButtonWidget("Run", (...args: any[]) => {
      this.execute();
    })),
      this.addCustomWidget(this.buttonWidget);

    this.onConstructed();
  }

  private execute() {
    const executor = new Executor();
    executor.execute(this.codeWidget.value);
  }
}

const NODE_CLASS = RgthreePowerConductor;

let parser: Parser | null = null;

async function getParser(): Promise<Parser> {
  if (parser) {
    return parser;
  }

  // @ts-ignore - Path is rewritten.
  const TreeSitter = (await import("rgthree/lib/tree-sitter.js")) as TreeSitter;
  await TreeSitter.Parser.init();
  const lang = await TreeSitter.Language.load("rgthree/lib/tree-sitter-python.wasm");
  parser = new TreeSitter.Parser() as Parser;
  parser.setLanguage(lang);
  return parser;
}

async function parse(code: string): Promise<Tree> {
  parser = await getParser();
  return parser.parse(code)!;
}

function check(value: any, msg = ""): asserts value {
  if (!value) {
    throw new Error(msg || "Error");
  }
}

type NodeType = SimpleNode;

class PyTuple {
  protected list: any[];
  constructor(...args: any[]) {
    if (args.length === 1 && args[0] instanceof PyTuple) {
      args = args[0].__unwrap__();
    }
    this.list = [...args];
  }
  count(v: any) {
    // TODO
  }
  index() {
    // TODO
  }

  __unwrap__() {
    const l = [...this.list];
    for (let i = 0; i < l.length; i++) {
      l[i] = l[i]?.__unwrap__ ? l[i].__unwrap__() : l[i];
    }
    return l;
  }

  __len__() {
    return this.list.length;
  }

  __add__(v: any) {
    if (!(v instanceof PyTuple)) {
      throw new Error("Can only concatenate tuple to tuple.");
    }
    return new PyTuple(this.__unwrap__().concat(v.__unwrap__()));
  }
}

class PyList extends PyTuple {
  append(...args: any[]) {
    this.list.push(...args);
  }

  clear() {
    this.list.length = 0;
  }

  insert() {
    // TODO
  }
  pop() {
    // TODO
  }
  remove() {
    // TODO
  }
  reverse() {
    // TODO
  }
  sort() {
    // TODO
  }

  override __add__(v: any) {
    if (!(v instanceof PyList)) {
      throw new Error("Can only concatenate list to list.");
    }
    return new PyList(this.__unwrap__().concat(v.__unwrap__()));
  }
}

class PyInt {}

function __unwrap__(...args: any[]) {
  for (let i = 0; i < args.length; i++) {
    args[i] = args[i]?.__unwrap__ ? args[i].__unwrap__() : args[i];
  }
  return args;
}

const BUILT_INS = new Map<string, Function>([
  ["round", (n: any) => Math.round(Number(n))],
  ["floor", (n: any) => Math.floor(Number(n))],
  ["ceil", (n: any) => Math.ceil(Number(n))],
  ["len", (n: any) => n?.length ?? n?.__len__?.()],
  ["print", (...args: any[]) => console.log(...__unwrap__(...args))],
  ["log", (...args: any[]) => console.log(...__unwrap__(...args))],
  // Types
  ["int", (n: any) => Math.floor(Number(n))],
  ["float", Number],
  ["list", (...args: any[]) => new PyList(...args)],
  ["tuple", (...args: any[]) => new PyTuple([...args])],
]);

class SimpleNode {
  type: string;
  text: string;
  children: SimpleNode[];
  private node: Node;

  constructor(node: Node) {
    this.type = node.type;
    this.text = node.text;
    if (this.type === "ERROR") {
      throw new Error(`Error found in parsing near "${this.text}"`);
    }
    this.children = [];
    for (const child of node.children) {
      this.children.push(new SimpleNode(child!));
    }
    this.node = node;
  }

  child(index: number): SimpleNode {
    const child = this.children[index];
    if (!child) throw Error(`No child at index ${index}.`);
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
  private readonly typeToHandler = new Map([
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
    // ["for_in_clause", this.handleForInClause.bind(this)],
    // ["if_clause", this.handleIfClause.bind(this)],

    ["comparison_operator", this.handleComparisonOperator.bind(this)],
    ["boolean_operator", this.handleBooleanOperator.bind(this)],
    ["not_operator", this.handleNotOperator.bind(this)],
    ["binary_operator", this.handleBinaryOperator.bind(this)],

    // Types
    ["integer", this.handleNumber.bind(this)],
    ["float", this.handleNumber.bind(this)],
    ["string", this.handleString.bind(this)],
    ["tuple", this.handleList.bind(this)],
    ["list", this.handleList.bind(this)],
    ["dictionary", this.handleDictionary.bind(this)],
    ["pair", this.handleDictionaryPair.bind(this)],
  ]);

  private ctx: {[k: string]: any} = {};
  private readonly ctxInitial: Executor["ctx"] = {};
  private isEvaluating = false;

  constructor(ctx: Executor["ctx"] | null = null) {
    this.ctxInitial = ctx || {};
  }

  async execute(code: string) {
    if (this.isEvaluating) {
      console.log("Already executing...");
      return;
    }
    this.isEvaluating = true;
    const root = (await parse(code)).rootNode;

    this.ctx = !!window.structuredClone ? structuredClone(this.ctxInitial) : {...this.ctxInitial};

    const value = await this.handleNode(new SimpleNode(root), this.ctx);

    console.log("=====");
    console.log(`value`, value?.__unwrap__?.() ?? value);
    console.log("context", this.ctx);
  }

  /**
   * The generic node handler, calls out to specific handlers based on the node type.
   */
  private async handleNode(node: NodeType, ctx: Executor["ctx"], tab = ""): Promise<any> {
    const type = node.type as string;

    if (ctx.hasOwnProperty("__returned__")) return ctx["__returned__"];

    console.log(`${tab}-----`);
    console.log(`${tab}eval_node`);
    console.log(`${tab}type: ${type}`);
    console.log(`${tab}text: ${node.text}`);
    console.log(`${tab}children: ${node.children?.length ?? 0}`);
    console.log(ctx);
    console.log(node);

    const handler = this.typeToHandler.get(type);
    check(handler, "Unhandled type: " + type);
    return handler(node, ctx, tab);
  }

  private async handleSwallow(node: NodeType, ctx = this.ctx, tab = "") {
    // No op
  }

  private async handleReturn(node: NodeType, ctx = this.ctx, tab = "") {
    const value = node.children.length > 1 ? this.handleNode(node.child(1), ctx, tab) : undefined;
    // Mark that we have a return value, as we may be deeper in evaluation, like going through an
    // if condition's body.
    ctx["__returned__"] = value;
    return value;
  }

  /**
   * Generic handler to loop over children of a node, and evaluate each.
   */
  private async handleChildren(node: NodeType, ctx = this.ctx, tab = "") {
    let lastValue = null;
    for (const child of node.children) {
      if (!child) continue;
      lastValue = await this.handleNode(child, ctx, tab + "  ");
    }
    return lastValue;
  }

  /**
   * Handles the retrieval of a variable identifier, already be set in the context.
   */
  private async handleIdentifier(node: NodeType, ctx = this.ctx, tab = "") {
    let value = ctx[node.text];
    if (!value) {
      value = BUILT_INS.get(node.text);
    }
    return value;
  }

  private async handleAttribute(node: NodeType, ctx = this.ctx, tab = "") {
    check(
      node.children.length === 3,
      "Expected 3 children for attr, identifier/attr, period, and identifier.",
    );
    const inst = await this.handleNode(node.child(0), ctx, tab);
    check(node.child(1)?.text === ".", "Expected period separating parts of attribute.");
    // const attr = await this.handleNode(node.child(2), inst, tab);
    // console.log('handleAttribute', inst, attr);
    const attr = node.child(2)!.text;
    check(!attr.startsWith("__") && !attr.endsWith("__"), `"${attr}" is not accessible.`);
    let attribute = inst[attr];
    check(attribute !== undefined, `"${attr}" not found on instance of type ${typeof inst}.`);
    // If the attribute is a function, then bind it to the instance.
    return typeof attribute === "function" ? attribute.bind(inst) : attribute;
  }

  /**
   * Handles the assignment to identifier(s).
   */
  private async handleAssignment(node: NodeType, ctx: Executor["ctx"], tab = "") {
    const vars = [];
    let value: any = null;
    for (const child of node.children) {
      if (!child) continue;
      if (child.type === "identifier") {
        vars.push(child.text);
      } else if (child.type === "=") {
        continue;
      } else {
        value = await this.handleNode(child, ctx, tab + "  ");
      }
    }
    check(vars.length, "No vars for assignment");
    check(vars.length === 1, "Not yet handling multiple vars");
    ctx[vars[0]!] = value;
    return value;
  }

  /**
   * Handles a named expression, like assigning a var in a list comprehension with:
   * `[name for node in node_list if (name := node.name)]`
   */
  private async handleNamedExpression(node: NodeType, ctx: Executor["ctx"], tab = "") {
    check(node.children.length === 3, "Expected three children for named expression.");
    check(node.child(0).type === "identifier", "Expected identifier first in named expression.");
    const varName = node.child(0).text;
    ctx[varName] = await this.handleNode(node.child(2), ctx, tab);
    return ctx[varName];
  }

  /**
   * Handles a function call.
   */
  private async handleCall(node: NodeType, ctx: Executor["ctx"], tab = "") {
    check(node.children.length === 2, "Expected 2 children for call, identifier and arguments.");
    const fn = await this.handleNode(node.children[0]!, ctx, tab);
    const args = await this.handleNode(node.children[1]!, ctx, tab);
    console.log("handleCall", fn, args);
    return fn(...args);
  }

  private async handleArgumentsList(node: NodeType, ctx: Executor["ctx"], tab = "") {
    return [(await this.handleList(node, ctx, tab)).__unwrap__()];
  }

  private async handleListComprehension(node: NodeType, ctx: Executor["ctx"], tab = "") {
    // Create a new context that we don't want to pollute our outer one.
    const finalList = new PyList();
    const newCtx = {...ctx};

    let finalEntryNode;
    const loopNodes: {forIn: NodeType; if?: NodeType}[] = [];

    for (const child of node.children) {
      if (!child || ["[", "]"].includes(child.type)) continue;
      if (child.type === "identifier" || child.type === "attribute") {
        if (finalEntryNode) {
          throw Error("Already have a list comprehension finalEntryNode.");
        }
        finalEntryNode = child;
      } else if (child.type === "for_in_clause") {
        loopNodes.push({forIn: child});
      } else if (child.type === "if_clause") {
        loopNodes[loopNodes.length - 1]!["if"] = child;
      }
    }
    if (!finalEntryNode) {
      throw Error("No list comprehension finalEntryNode.");
    }
    // loopNodes.push(finalEntryNode);

    console.log(`${tab}handleListComprehension.loopNodes`, loopNodes);

    const handleLoop = async (loopNodes: {forIn: NodeType; if?: NodeType}[]) => {
      const loopNode = loopNodes.shift()!;
      console.log(`${tab}handleLoop`, loopNode);
      const identifierNode = loopNode.forIn.child(1)!;
      check(identifierNode.type === "identifier");
      const loopId = identifierNode.text;
      const iterable = (await this.handleNode(loopNode.forIn.child(3)!, newCtx, tab)).__unwrap__();
      console.log(`${tab}handleLoop.iterable`, iterable);

      for (const item of iterable) {
        const ifCtx = {...newCtx};
        // TODO: Handle tuple for dict
        ifCtx[loopId] = item;
        if (loopNode.if) {
          const ifNode = loopNode.if;
          check(ifNode.children.length === 2, "Expected 2 children for if_clause.");
          check(ifNode.child(0).text === "if", "Expected first child to be 'if'.");
          const good = await this.handleNode(ifNode.child(1), ifCtx, tab);
          if (!good) continue;
        }
        Object.assign(newCtx, ifCtx);
        // newCtx[loopId] = item;
        if (loopNodes.length) {
          await handleLoop(loopNodes);
        } else {
          finalList.append(await this.handleNode(finalEntryNode, newCtx, tab));
        }
      }
      loopNodes.unshift(loopNode);
    };

    await handleLoop(loopNodes);

    return finalList;

    /// ..whoa
  }

  // private async handleForInClause(node: NodeType, ctx: Executor["ctx"], tab = "") {
  //   check(
  //     node.children.length === 4,
  //     "Expected 4 children for for-in (for, identifier, in, identifier).",
  //   );
  //   const varName = node.child(1)!.text;
  //   const list = (await this.handleNode(node.child(3)!, ctx, tab)).__unwrap__();
  //   return list;
  // }

  private async handleNumber(node: NodeType, ctx = this.ctx, tab = "") {
    return Number(node.text);
  }

  private async handleString(node: NodeType, ctx = this.ctx, tab = "") {
    check(node.children.length === 3, "Expected 3 children for str (quotes and value).");
    return String(node.child(1)!.text);
  }

  private async handleList(node: NodeType, ctx = this.ctx, tab = "") {
    const list = [];
    for (const child of node.children) {
      if (!child || ["(", "[", ",", "]", ")"].includes(child.type)) continue;
      list.push(await this.handleNode(child, ctx, tab + "  "));
    }
    if (node.type === "tuple") {
      return new PyTuple(...list);
    }
    return new PyList(...list);
  }

  private async handleComparisonOperator(node: NodeType, ctx = this.ctx, tab = "") {
    const op = node.child(1).text;
    const left = await this.handleNode(node.child(0), ctx, tab);
    const right = await this.handleNode(node.child(2), ctx, tab);
    if (op === "==") return left === right; // Python '==' is equiv to '===' in JS.
    if (op === "!=") return left !== right;
    if (op === ">") return left > right;
    if (op === ">=") return left >= right;
    if (op === "<") return left < right;
    if (op === "<=") return left <= right;
    if (op === "in") return (right.__unwrap__ ? right.__unwrap__() : right).includes(left);
    throw new Error(`Comparison not handled: "${op}"`);
  }
  private async handleBooleanOperator(node: NodeType, ctx = this.ctx, tab = "") {
    const op = node.child(1).text;
    const left = await this.handleNode(node.child(0), ctx, tab);
    if (!left && op === "or") return left;
    const right = await this.handleNode(node.child(2), ctx, tab);
    if (op === "and") return left && right;
    if (op === "or") return left || right;
  }

  private async handleNotOperator(node: NodeType, ctx = this.ctx, tab = "") {
    check(node.children.length === 2, "Expected 2 children for not operator.");
    check(node.child(0).text === "not", "Expected first child to be 'not'.");
    const value = await this.handleNode(node.child(1), ctx, tab);
    return !value;
  }

  private async handleBinaryOperator(node: NodeType, ctx = this.ctx, tab = "") {
    const op = node.child(1).text;
    const left = await this.handleNode(node.child(0), ctx, tab);
    const right = await this.handleNode(node.child(2), ctx, tab);
    if (left.constructor !== right.constructor) {
      throw new Error(`Can only run ${op} operator on same type.`);
    }
    if (op === "+") return left.__add__ ? left.__add__(right) : left + right;
    if (op === "-") return left - right;
    if (op === "/") return left / right;
    if (op === "//") return Math.floor(left / right);
    if (op === "*") return left * right;
    if (op === "%") return left % right;
    if (op === "&") return left & right;
    if (op === "|") return left | right;
    if (op === "^") return left ^ right;
    if (op === "<<") return left << right;
    if (op === ">>") return left >> right;
    throw new Error(`Comparison not handled: "${op}"`);
  }

  private async handleDictionary(node: NodeType, ctx = this.ctx, tab = "") {
    const dict = {};
    for (const child of node.children) {
      if (!child || ["{", "}"].includes(child.type)) continue;
      const pair = await this.handleNode(child, ctx, tab + "  ");
      Object.assign(dict, pair);
    }
    return dict;
  }

  private async handleDictionaryPair(node: NodeType, ctx = this.ctx, tab = "") {
    check(node.children.length === 3, "Expected 3 children for dict pair.");
    let varName = await this.handleNode(node.child(0)!, ctx, tab + "  ");
    let varValue = await this.handleNode(node.child(2)!, ctx, tab + "  ");
    check(typeof varName === "string", "Expected varname to be string.");
    return {[varName]: varValue};
  }
}

/** Register the node. */
app.registerExtension({
  name: "rgthree.PowerConductor",
  registerCustomNodes() {
    if (CONFIG_SERVICE.getConfigValue("unreleased.power_conductor.enabled")) {
      NODE_CLASS.setUp();
    }
  },
});
