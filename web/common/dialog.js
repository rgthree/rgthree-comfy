import { createElement as $el, getClosestOrSelf } from "./utils_dom.js";
export class RgthreeDialog extends EventTarget {
    constructor(options) {
        super();
        this.options = options;
        let container = $el("div.rgthree-dialog-container");
        this.element = $el("dialog", {
            classes: ["rgthree-dialog", options.class || ""],
            child: container,
            parent: document.body,
            events: {
                click: (event) => {
                    if (!this.element.open ||
                        event.target === container ||
                        getClosestOrSelf(event.target, `.rgthree-dialog-container`) === container) {
                        return;
                    }
                    return this.close();
                },
            },
        });
        if (options.title) {
            $el("div.rgthree-dialog-container-title", {
                parent: container,
                child: options.title.includes("<h2") ? options.title : $el("h2", { html: options.title }),
            });
        }
        this.contentElement = $el("div.rgthree-dialog-container-content", {
            parent: container,
            child: options.content,
        });
        const footerEl = $el("footer.rgthree-dialog-container-footer", { parent: container });
        for (const button of options.buttons || []) {
            $el("button", {
                text: button.label,
                className: button.className,
                disabled: !!button.disabled,
                parent: footerEl,
                events: {
                    click: (e) => {
                        var _a;
                        (_a = button.callback) === null || _a === void 0 ? void 0 : _a.call(button, e);
                    },
                },
            });
        }
        if (options.closeButtonLabel !== false) {
            $el("button", {
                text: options.closeButtonLabel || "Close",
                className: "rgthree-button",
                parent: footerEl,
                events: {
                    click: (e) => {
                        this.close(e);
                    },
                },
            });
        }
    }
    show() {
        document.body.classList.add("rgthree-dialog-open");
        this.element.showModal();
        this.dispatchEvent(new CustomEvent("show"));
        return this;
    }
    async close(e) {
        if (this.options.onBeforeClose && !(await this.options.onBeforeClose())) {
            return;
        }
        document.body.classList.remove("rgthree-dialog-open");
        this.element.close();
        this.element.remove();
        this.dispatchEvent(new CustomEvent("close"));
    }
}
export class RgthreeHelpDialog extends RgthreeDialog {
    constructor(node, content, opts = {}) {
        const options = Object.assign({}, opts, {
            class: "-iconed -help",
            title: `${node.title.replace("(rgthree)", "")} <small>by rgthree</small>`,
            content,
        });
        super(options);
    }
}
