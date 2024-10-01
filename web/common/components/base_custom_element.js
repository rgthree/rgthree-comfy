import { $el } from "../../common/utils_dom.js";
const CSS_STYLE_SHEETS = new Map();
const HTML_TEMPLATE_FILES = new Map();
async function getStyleSheet(name) {
    if (!CSS_STYLE_SHEETS.has(name)) {
        try {
            const response = await fetch(`rgthree/common/components/${name.replace("rgthree-", "").replace(/\-/g, "_")}.css`);
            const text = await response.text();
            CSS_STYLE_SHEETS.set(name, text);
        }
        catch (e) {
            alert("Error loading rgthree custom component css.");
        }
    }
    return CSS_STYLE_SHEETS.get(name);
}
async function getTemplateMarkup(name) {
    if (!HTML_TEMPLATE_FILES.has(name)) {
        try {
            const response = await fetch(`rgthree/common/components/${name.replace("rgthree-", "").replace(/\-/g, "_")}.html`);
            const text = await response.text();
            HTML_TEMPLATE_FILES.set(name, text);
        }
        catch (e) {
        }
    }
    return HTML_TEMPLATE_FILES.get(name);
}
export class RgthreeCustomElement extends HTMLElement {
    constructor() {
        super(...arguments);
        this.connected = false;
        this.templates = new Map();
    }
    static create() {
        if (this.name === "rgthree-override") {
            throw new Error("Must override component NAME");
        }
        if (!customElements.get(this.name)) {
            customElements.define(this.NAME, this);
        }
        return document.createElement(this.NAME);
    }
    onFirstConnected() {
    }
    ;
    onReconnected() {
    }
    ;
    onConnected() {
    }
    ;
    onDisconnected() {
    }
    ;
    async connectedCallback() {
        const elementName = this.constructor.NAME;
        const wasConnected = this.connected;
        if (!wasConnected) {
            this.connected = true;
        }
        if (!this.shadow) {
            const [stylesheet, markup] = await Promise.all([
                getStyleSheet(elementName),
                getTemplateMarkup(elementName),
            ]);
            if (markup) {
                const temp = $el('div');
                const templatesMarkup = markup.match(/<template[^]*?<\/template>/gm) || [];
                for (const markup of templatesMarkup) {
                    temp.innerHTML = markup;
                    const template = temp.children[0];
                    if (!(template instanceof HTMLTemplateElement)) {
                        throw new Error('Not a template element.');
                    }
                    const id = template.getAttribute('id');
                    if (!id) {
                        throw new Error('Not template id.');
                    }
                    this.templates.set(id, template);
                }
            }
            this.shadow = this.attachShadow({ mode: "open" });
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(stylesheet);
            this.shadow.adoptedStyleSheets = [sheet];
            let template;
            if (this.templates.has(elementName)) {
                template = this.templates.get(elementName);
            }
            else if (this.templates.has(elementName.replace('rgthree-', ''))) {
                template = this.templates.get(elementName.replace('rgthree-', ''));
            }
            if (template) {
                this.shadow.appendChild(template.content.cloneNode(true));
            }
            this.onFirstConnected();
        }
        else {
            this.onReconnected();
        }
        this.onConnected();
    }
    disconnectedCallback() {
        this.connected = false;
        this.onDisconnected();
    }
}
RgthreeCustomElement.NAME = "rgthree-override";
