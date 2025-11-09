import {app} from "scripts/app.js";
import {iconGear, iconStarFilled, logoRgthreeAsync} from "rgthree/common/media/svgs.js";
import {$el, empty} from "rgthree/common/utils_dom.js";
import {SERVICE as BOOKMARKS_SERVICE} from "./services/bookmarks_services.js";
import {SERVICE as CONFIG_SERVICE} from "./services/config_service.js";
import {RgthreeConfigDialog} from "./config.js";
import {wait} from "rgthree/common/shared_utils.js";

let rgthreeButtonGroup: RgthreeComfyButtonGroup | null = null;

function addRgthreeTopBarButtons() {
  if (!CONFIG_SERVICE.getFeatureValue("comfy_top_bar_menu.enabled")) {
    if (rgthreeButtonGroup?.element?.parentElement) {
      rgthreeButtonGroup.element.parentElement.removeChild(rgthreeButtonGroup.element);
    }
    return;
  } else if (rgthreeButtonGroup) {
    app.menu?.settingsGroup.element.before(rgthreeButtonGroup.element);
    return;
  }

  const buttons = [];

  const rgthreeButton = new RgthreeComfyButton({
    icon: "<svg></svg>",
    tooltip: "rgthree-comfy",
    primary: true,
    // content: 'rgthree-comfy',
    // app,
    enabled: true,
    classList: "comfyui-button comfyui-menu-mobile-collapse primary",
  });
  buttons.push(rgthreeButton);
  logoRgthreeAsync().then((t) => {
    rgthreeButton.setIcon(t);
  });

  rgthreeButton.withPopup(
    new RgthreeComfyPopup(
      {target: rgthreeButton.element},
      $el("menu.rgthree-menu.rgthree-top-menu", {
        children: [
          $el("li", {
            child: $el("button.rgthree-button-reset", {
              html: iconGear + "Settings (rgthree-comfy)",
              onclick: () => new RgthreeConfigDialog().show(),
            }),
          }),
          $el("li", {
            child: $el("button.rgthree-button-reset", {
              html: iconStarFilled + "Star on Github",
              onclick: () => window.open("https://github.com/rgthree/rgthree-comfy", "_blank"),
            }),
          }),
        ],
      }),
    ),
    "click",
  );

  if (CONFIG_SERVICE.getFeatureValue("comfy_top_bar_menu.button_bookmarks.enabled")) {
    const bookmarksListEl = $el("menu.rgthree-menu.rgthree-top-menu");
    bookmarksListEl.appendChild(
      $el("li.rgthree-message", {
        child: $el("span", {text: "No bookmarks in current workflow."}),
      }),
    );
    const bookmarksButton = new RgthreeComfyButton({
      icon: "bookmark",
      tooltip: "Workflow Bookmarks (rgthree-comfy)",
      // app,
    });
    const bookmarksPopup = new RgthreeComfyPopup(
      {target: bookmarksButton.element, modal: false},
      bookmarksListEl,
    );
    bookmarksPopup.onOpen(() => {
      const bookmarks = BOOKMARKS_SERVICE.getCurrentBookmarks();
      empty(bookmarksListEl);
      if (bookmarks.length) {
        for (const b of bookmarks) {
          bookmarksListEl.appendChild(
            $el("li", {
              child: $el("button.rgthree-button-reset", {
                text: `[${b.shortcutKey}] ${b.title}`,
                onclick: () => {
                  b.canvasToBookmark();
                },
              }),
            }),
          );
        }
      } else {
        bookmarksListEl.appendChild(
          $el("li.rgthree-message", {
            child: $el("span", {text: "No bookmarks in current workflow."}),
          }),
        );
      }
      // bookmarksPopup.update();
    });
    bookmarksButton.withPopup(bookmarksPopup, "hover");
    buttons.push(bookmarksButton);
  }

  rgthreeButtonGroup = new RgthreeComfyButtonGroup(...buttons);
  app.menu?.settingsGroup.element.before(rgthreeButtonGroup.element);
}

app.registerExtension({
  name: "rgthree.TopMenu",
  async setup() {
    addRgthreeTopBarButtons();

    CONFIG_SERVICE.addEventListener("config-change", ((e: CustomEvent) => {
      if (e.detail?.key?.includes("features.comfy_top_bar_menu")) {
        addRgthreeTopBarButtons();
      }
    }) as EventListener);
  },
});

// The following are rough hacks since ComfyUI took away their button/buttongroup/popup
// functionality. TODO: Find a better spot to add rgthree controls to the UI, I suppose.

class RgthreeComfyButtonGroup {
  element = $el("div.rgthree-comfybar-top-button-group");
  buttons: RgthreeComfyButton[];

  constructor(...buttons: RgthreeComfyButton[]) {
    this.buttons = buttons;
    this.update();
  }

  insert(button: RgthreeComfyButton, index: number) {
    this.buttons.splice(index, 0, button);
    this.update();
  }

  append(button: RgthreeComfyButton) {
    this.buttons.push(button);
    this.update();
  }

  remove(indexOrButton: RgthreeComfyButton | number) {
    if (typeof indexOrButton !== "number") {
      indexOrButton = this.buttons.indexOf(indexOrButton);
    }
    if (indexOrButton > -1) {
      const btn = this.buttons.splice(indexOrButton, 1);
      this.update();
      return btn;
    }
    return null;
  }

  update() {
    this.element.replaceChildren(...this.buttons.map((b) => b["element"] ?? b));
  }
}

interface RgthreeComfyButtonOptions {
  icon?: string;
  primary?: boolean;
  overIcon?: string;
  iconSize?: number;
  content?: string | HTMLElement;
  tooltip?: string;
  enabled?: boolean;
  action?: (e: Event, btn: RgthreeComfyButton) => void;
  classList?: string;
  visibilitySetting?: {id: string; showValue: any};
  // app?: ComfyApp;
}

class RgthreeComfyButton {
  element = $el("button.rgthree-comfybar-top-button.rgthree-button-reset.rgthree-button");
  iconElement = $el("span.rgthree-button-icon");
  constructor(opts: RgthreeComfyButtonOptions) {
    opts.icon && this.setIcon(opts.icon);
    opts.tooltip && this.element.setAttribute("title", opts.tooltip);
    opts.primary && this.element.classList.add("-primary");
  }

  setIcon(iconOrMarkup: string) {
    const markup = iconOrMarkup.startsWith("<")
      ? iconOrMarkup
      : `<i class="mdi mdi-${iconOrMarkup}"></i>`;
    this.iconElement.innerHTML = markup;
    if (!this.iconElement.parentElement) {
      this.element.appendChild(this.iconElement);
    }
  }

  withPopup(popup: RgthreeComfyPopup, trigger: "click" | "hover") {
    if (trigger === "click") {
      this.element.addEventListener("click", () => {
        popup.open();
      });
    }
    if (trigger === "hover") {
      this.element.addEventListener("pointerenter", () => {
        popup.open();
      });
    }
  }
}

interface RgthreeComfyPopupOptions {
  target: HTMLElement;
  classList?: string;
  modal?: boolean;
}

class RgthreeComfyPopup {
  element: HTMLElement;
  target?: HTMLElement;
  onOpenFn: (() => Promise<void> | void) | null = null;
  opts: RgthreeComfyPopupOptions;

  onWindowClickBound = this.onWindowClick.bind(this);

  constructor(opts: RgthreeComfyPopupOptions, element: HTMLElement) {
    this.element = element;
    this.opts = opts;
    opts.target && (this.target = opts.target);
    opts.modal && this.element.classList.add("-modal");
  }

  async open() {
    if (!this.target) {
      throw new Error("No target for RgthreeComfyPopup");
    }
    if (this.onOpenFn) {
      await this.onOpenFn();
    }
    await wait(16);
    const rect = this.target.getBoundingClientRect();
    this.element.setAttribute("state", "measuring");
    document.body.appendChild(this.element);
    this.element.style.position = "fixed";
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top + rect.height}px`;
    this.element.setAttribute("state", "open");
    if (this.opts.modal) {
      document.body.classList.add("rgthree-modal-menu-open");
    }
    window.addEventListener("click", this.onWindowClickBound);
  }

  close() {
    this.element.remove();
    document.body.classList.remove("rgthree-modal-menu-open");
    window.removeEventListener("click", this.onWindowClickBound);
  }

  onOpen(fn: (() => void) | null) {
    this.onOpenFn = fn;
  }

  onWindowClick() {
    this.close();
  }
}
