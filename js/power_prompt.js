import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
class PowerPrompt {
    constructor(node, nodeData) {
        this.node = node;
        this.node.properties = this.node.properties || {};
        this.nodeData = nodeData;
        this.promptEl = node.widgets[0].inputEl;
        this.refreshCombos(nodeData);
        this.boundOnFreshNodeDefs = this.onFreshNodeDefs.bind(this);
        api.addEventListener('fresh-node-defs', this.boundOnFreshNodeDefs);
        const oldNodeRemoved = this.node.onRemoved;
        this.node.onRemoved = () => {
            oldNodeRemoved === null || oldNodeRemoved === void 0 ? void 0 : oldNodeRemoved.call(this.node);
            api.removeEventListener('fresh-node-defs', this.boundOnFreshNodeDefs);
        };
    }
    onFreshNodeDefs(event) {
        this.refreshCombos(event.detail[this.nodeData.name]);
    }
    refreshCombos(nodeData) {
        var _a;
        this.nodeData = nodeData;
        for (const [key, value] of Object.entries(((_a = this.nodeData.input) === null || _a === void 0 ? void 0 : _a.hidden) || {})) {
            if (key.includes('embedding') && Array.isArray(value[0])) {
                const values = value[0];
                if (!this.embeddingWidget) {
                    this.embeddingWidget = this.node.addWidget('combo', key.replace(/_/g, ' '), values[0], (selected) => {
                        if (selected !== values[0]) {
                            this.insertText(`embedding:${selected}`);
                        }
                        this.embeddingWidget.value = values[0];
                    }, {
                        values,
                        serialize: false,
                    });
                }
                this.embeddingWidget.options.values = values;
                this.embeddingWidget.value = values[0];
            }
            else if (key.includes('saved') && Array.isArray(value[0])) {
                const values = value[0];
                if (values.length <= 1) {
                    this.savedValues = [];
                    if (this.savedWidget) {
                        this.node.widgets.splice(this.node.widgets.indexOf(this.savedWidget), 1);
                        this.savedWidget = undefined;
                    }
                    continue;
                }
                if (key.startsWith('values')) {
                    this.savedValues = values;
                }
                else {
                    if (!this.savedWidget) {
                        this.savedWidget = this.node.addWidget('combo', key.replace(/_/g, ' '), values[0], (selected) => {
                            if (selected !== values[0]) {
                                this.insertText(this.savedValues[values.indexOf(selected)]);
                            }
                            this.savedWidget.value = values[0];
                        }, {
                            values,
                            serialize: false,
                        });
                    }
                    this.savedWidget.options.values = values;
                    this.savedWidget.value = values[0];
                }
            }
        }
    }
    insertText(text) {
        if (this.promptEl) {
            const noSpace = [',', '\n'];
            let prompt = this.promptEl.value;
            let first = prompt.substring(0, this.promptEl.selectionStart).replace(/ +$/, '');
            first = first + (noSpace.includes(first[first.length - 1]) ? '' : first.length ? ' ' : '');
            let second = prompt.substring(this.promptEl.selectionEnd).replace(/^ +/, '');
            second = (noSpace.includes(second[0]) ? '' : second.length ? ' ' : '') + second;
            this.promptEl.value = first + text + second;
            this.promptEl.focus();
            this.promptEl.selectionStart = first.length;
            this.promptEl.selectionEnd = first.length + text.length;
        }
    }
}
app.registerExtension({
    name: 'rgthree.PowerPrompt',
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === 'Power Prompt (rgthree)') {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                this.powerPrompt = new PowerPrompt(this, nodeData);
            };
        }
    },
});
