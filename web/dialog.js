import { createElement as $el } from "./utils_dom.js";
export class RgthreeDialog extends EventTarget {
    constructor(options) {
        super();
        let contentEl = $el("div.rgthree-dialog-container");
        this.element = $el("dialog", {
            classes: ["rgthree-dialog", options.class || ""],
            child: contentEl,
            parent: document.body,
            events: {
                click: (event) => {
                    let rect = this.element.getBoundingClientRect();
                    if (event.clientY < rect.top ||
                        event.clientY > rect.bottom ||
                        event.clientX < rect.left ||
                        event.clientX > rect.right) {
                        return this.close();
                    }
                },
            },
        });
        if (options.title) {
            $el("h2.rgthree-dialog-container-title", {
                parent: contentEl,
                child: options.title,
            });
        }
        $el("div.rgthree-dialog-container-content", {
            parent: contentEl,
            child: options.content,
        });
        $el("footer.rgthree-dialog-container-footer", {
            parent: contentEl,
            child: $el("button", {
                text: options.closeButtonLabel || "Close",
                events: {
                    click: () => {
                        this.close();
                    },
                },
            }),
        });
    }
    show() {
        this.element.showModal();
        this.dispatchEvent(new CustomEvent('show'));
        return this;
    }
    close() {
        this.element.close();
        this.dispatchEvent(new CustomEvent('close'));
    }
}
export class RgthreeHelpDialog extends RgthreeDialog {
    constructor(node, content, opts = {}) {
        const options = Object.assign({}, opts, {
            class: "-help",
            title: `${node.title.replace("(rgthree)", "")} <small>by rgthree</small>`,
            content,
        });
        super(options);
    }
}
