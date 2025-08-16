import { app } from "../../../scripts/app.js";
import { NodeTypesString } from "../constants.js";
import { traverseNodesDepthFirst } from "../utils.js";
class BookmarksService {
    getCurrentBookmarks() {
        const bookmarks = [];
        traverseNodesDepthFirst(app.graph.nodes, (n) => {
            if (n.type === NodeTypesString.BOOKMARK) {
                bookmarks.push(n);
            }
        });
        return bookmarks.sort((a, b) => a.title.localeCompare(b.title));
    }
}
export const SERVICE = new BookmarksService();
