import type {Bookmark} from "../bookmark.js";

import {app} from "scripts/app.js";
import {NodeTypesString} from "../constants.js";
import {traverseNodesDepthFirst} from "../utils.js";

class BookmarksService {
  /**
   * Gets a list of the current bookmarks within the current workflow.
   */
  getCurrentBookmarks(): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    traverseNodesDepthFirst(app.graph.nodes, (n) => {
      if (n.type === NodeTypesString.BOOKMARK) {
        bookmarks.push(n as Bookmark);
      }
    });
    return bookmarks.sort((a, b) => a.title.localeCompare(b.title));
  }
}

/** The BookmarksService singleton. */
export const SERVICE = new BookmarksService();
