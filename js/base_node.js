export class RgthreeBaseNode extends LGraphNode {
    constructor(title = RgthreeBaseNode.title) {
        super(title);
        this.isVirtualNode = true;
        this._tempWidth = 0;
        if (title == '__NEED_NAME__') {
            throw new Error('RgthreeBaseNode needs overrides.');
        }
        this.properties = this.properties || {};
    }
    set mode(mode) {
        if (this.mode_ != mode) {
            this.mode_ = mode;
            this.onModeChange();
        }
    }
    get mode() {
        return this.mode_;
    }
    onModeChange() {
    }
    async handleAction(action) {
        action;
    }
    removeWidget(widgetOrSlot) {
        if (typeof widgetOrSlot === 'number') {
            this.widgets.splice(widgetOrSlot, 1);
        }
        else if (widgetOrSlot) {
            const index = this.widgets.indexOf(widgetOrSlot);
            if (index > -1) {
                this.widgets.splice(index, 1);
            }
        }
    }
}
RgthreeBaseNode.exposedActions = [];
RgthreeBaseNode.title = "__NEED_NAME__";
RgthreeBaseNode.category = 'rgthree';
RgthreeBaseNode._category = 'rgthree';
