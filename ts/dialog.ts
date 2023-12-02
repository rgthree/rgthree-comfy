import { LGraphNode, LGraphNodeConstructor } from "litegraph.js";
import { createElement as $el } from "./utils_dom.js";

type RgthreeDialogOptions = {
  content: string | HTMLElement | HTMLElement[];
  class?: string | string[];
  title?: string;
  closeX?: boolean;
  closeOnEsc?: boolean;
  closeOnModalClick?: boolean;
  closeButtonLabel?: string;
};

/**
 * A Dialog that shows content, and closes.
 */
export class RgthreeDialog {
  element: HTMLDialogElement;

  constructor(options: RgthreeDialogOptions) {
    let contentEl = $el("div.rgthree-dialog-container");
    this.element = $el("dialog", {
      classes: ["rgthree-dialog", options.class || ""],
      child: contentEl,
      parent: document.body,
      events: {
        click: (event: MouseEvent) => {
          let rect = this.element.getBoundingClientRect();
          if (
            event.clientY < rect.top ||
            event.clientY > rect.bottom ||
            event.clientX < rect.left ||
            event.clientX > rect.right
          ) {
            return this.element.close();
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
            this.element.close();
          },
        },
      }),
    });
  }

  show() {
    this.element.showModal();
  }
}

/**
 * A help extension for the dialog class that standardizes help content.
 */
export class RgthreeHelpDialog extends RgthreeDialog {
  constructor(
    node: LGraphNode | LGraphNodeConstructor,
    content: string,
    opts: Partial<RgthreeDialogOptions> = {},
  ) {
    const options = Object.assign({}, opts, {
      class: "-help",
      title: `${node.title.replace("(rgthree)", "")} <small>by rgthree</small>`,
      content,
    });
    super(options);
  }
}
