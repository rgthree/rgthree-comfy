import { app } from "../../scripts/app.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { createElement as $el } from "../../rgthree/common/utils_dom.js";
import { RgthreeDialog } from "../../rgthree/common/dialog.js";
const PASS_THROUGH = function (item) {
    return item;
};
export async function showLoraChooser(event, callback, parentMenu, loras) {
    var _a, _b;
    const canvas = app.canvas;
    if (!loras) {
        loras = ["None", ...(await rgthreeApi.getLoras().then((loras) => loras.map((l) => l.file)))];
    }
    new LiteGraph.ContextMenu(loras, {
        event: event,
        parentMenu: parentMenu != null ? parentMenu : undefined,
        title: "Choose a lora",
        scale: Math.max(1, (_b = (_a = canvas.ds) === null || _a === void 0 ? void 0 : _a.scale) !== null && _b !== void 0 ? _b : 1),
        className: "dark",
        callback,
    });
}

export async function showTemplateChooser(event, callback, parentMenu, templates) {
    try {
        // Fetch templates if not provided
        if (!templates) {
            const templateData = await rgthreeApi.getPowerLoraTemplates();
            templates = templateData || [];
        }
        
        // If no templates exist, show message
        if (!templates.length) {
            new LiteGraph.ContextMenu(["NONE - No templates available"], {
                event: event,
                title: "Choose a template",
                callback: () => callback("NONE"),
            });
            return;
        }
        
        // Create dialog with search functionality
        const searchInput = $el("input", {
            type: "text",
            placeholder: "Search templates...",
            style: { 
                width: "100%", 
                marginBottom: "10px", 
                padding: "8px",
                border: "1px solid #333",
                backgroundColor: "#2a2a2a",
                color: "#fff"
            }
        });
        
        const templateList = $el("div", {
            style: { 
                maxHeight: "300px", 
                overflowY: "auto",
                border: "1px solid #333",
                backgroundColor: "#1a1a1a"
            }
        });
        
        const contentContainer = $el("div", {
            children: [searchInput, templateList],
            style: { minWidth: "400px" }
        });
        
        // Function to render template items
        function renderTemplates(filteredTemplates) {
            templateList.innerHTML = "";
            filteredTemplates.forEach(template => {
                const deleteButton = $el("button", {
                    text: "🗑️",
                    style: {
                        backgroundColor: "#d44",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        marginLeft: "10px",
                        float: "right"
                    },
                    events: {
                        click: async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete template "${template.name}"?`)) {
                                try {
                                    await rgthreeApi.deletePowerLoraTemplate(template.name);
                                    // Remove from current templates array
                                    const index = templates.findIndex(t => t.name === template.name);
                                    if (index !== -1) {
                                        templates.splice(index, 1);
                                    }
                                    // Re-render with current search
                                    const searchTerm = searchInput.value.toLowerCase();
                                    const newFiltered = templates.filter(t => 
                                        t.name.toLowerCase().includes(searchTerm)
                                    );
                                    renderTemplates(newFiltered);
                                } catch (error) {
                                    console.error('Failed to delete template:', error);
                                    alert('Failed to delete template. Please try again.');
                                }
                            }
                        },
                        mouseenter: (e) => {
                            e.target.style.backgroundColor = "#f44";
                        },
                        mouseleave: (e) => {
                            e.target.style.backgroundColor = "#d44";
                        }
                    }
                });

                const templateItem = $el("div", {
                    className: "template-item",
                    style: {
                        padding: "10px",
                        borderBottom: "1px solid #333",
                        cursor: "pointer",
                        backgroundColor: "#2a2a2a",
                        position: "relative",
                        minHeight: "60px"
                    },
                    children: [
                        deleteButton,
                        $el("div", { 
                            text: template.name,
                            style: { 
                                fontWeight: "bold", 
                                marginBottom: "4px",
                                marginRight: "50px" // Leave space for delete button
                            }
                        }),
                        $el("div", { 
                            text: `${template.items || 0} loras - Modified: ${template.modified ? new Date(template.modified * 1000).toLocaleDateString() : 'Unknown'}`,
                            style: { 
                                fontSize: "12px", 
                                color: "#aaa",
                                marginRight: "50px" // Leave space for delete button
                            }
                        })
                    ],
                    events: {
                        click: (e) => {
                            // Don't trigger if clicking the delete button
                            if (e.target.closest('button')) return;
                            dialog.close();
                            callback(template.name);
                        },
                        mouseenter: (e) => {
                            if (!e.target.closest('button')) {
                                e.target.style.backgroundColor = "#3a3a3a";
                            }
                        },
                        mouseleave: (e) => {
                            if (!e.target.closest('button')) {
                                e.target.style.backgroundColor = "#2a2a2a";
                            }
                        }
                    }
                });
                templateList.appendChild(templateItem);
            });
        }
        
        // Initial render
        renderTemplates(templates);
        
        // Search functionality
        searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredTemplates = templates.filter(template => 
                template.name.toLowerCase().includes(searchTerm)
            );
            renderTemplates(filteredTemplates);
        });
        
        const dialog = new RgthreeDialog({
            title: "Choose a Template",
            content: contentContainer,
            buttons: [
                {
                    label: "Cancel",
                    callback: () => dialog.close()
                }
            ]
        });
        
        dialog.show();
        
        // Focus search input after dialog opens
        setTimeout(() => searchInput.focus(), 100);
        
    } catch (error) {
        console.error('Failed to show template chooser:', error);
        // Fallback to simple menu
        new LiteGraph.ContextMenu(["NONE - Error loading templates"], {
            event: event,
            title: "Choose a template",
            callback: () => callback("NONE"),
        });
    }
}
export function showNodesChooser(event, mapFn, callback, parentMenu) {
    var _a, _b;
    const canvas = app.canvas;
    const nodesOptions = app.graph._nodes
        .map(mapFn)
        .filter((e) => e != null);
    nodesOptions.sort((a, b) => {
        return a.value - b.value;
    });
    new LiteGraph.ContextMenu(nodesOptions, {
        event: event,
        parentMenu,
        title: "Choose a node id",
        scale: Math.max(1, (_b = (_a = canvas.ds) === null || _a === void 0 ? void 0 : _a.scale) !== null && _b !== void 0 ? _b : 1),
        className: "dark",
        callback,
    });
}
export function showWidgetsChooser(event, node, mapFn, callback, parentMenu) {
    var _a, _b;
    const options = (node.widgets || [])
        .map(mapFn)
        .filter((e) => e != null);
    if (options.length) {
        const canvas = app.canvas;
        new LiteGraph.ContextMenu(options, {
            event,
            parentMenu,
            title: "Choose an input/widget",
            scale: Math.max(1, (_b = (_a = canvas.ds) === null || _a === void 0 ? void 0 : _a.scale) !== null && _b !== void 0 ? _b : 1),
            className: "dark",
            callback,
        });
    }
}
