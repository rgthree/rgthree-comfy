import { app } from "../../../scripts/app.js";
import { NodeTypesString } from "../constants.js";
class BookmarksService {
    getCurrentBookmarks() {
        return app.graph._nodes
            .filter((n) => n.type === NodeTypesString.BOOKMARK)
            .sort((a, b) => a.title.localeCompare(b.title));
    }
}
export const SERVICE = new BookmarksService();
