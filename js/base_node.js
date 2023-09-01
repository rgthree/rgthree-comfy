export class RgthreeBaseNode extends LGraphNode {
    constructor(title = RgthreeBaseNode.title) {
        super(title);
        this.isVirtualNode = true;
        if (title == '__NEED_NAME__') {
            throw new Error('RgthreeBaseNode needs overrides.');
        }
        this.properties = this.properties || {};
    }
    onModeChange() {
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
}
RgthreeBaseNode.title = "__NEED_NAME__";
RgthreeBaseNode.category = 'rgthree';
RgthreeBaseNode._category = 'rgthree';
