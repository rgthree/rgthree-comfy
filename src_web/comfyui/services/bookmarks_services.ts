import type { Bookmark } from "../bookmark.js";

import { app } from "scripts/app.js";
import { NodeTypesString } from "../constants.js";

class BookmarksService {
  /**
   * Gets a list of the current bookmarks within the current workflow.
   */
  getCurrentBookmarks() {
    return app.graph._nodes
      .filter((n): n is Bookmark => n.type === NodeTypesString.BOOKMARK)
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}

/** The BookmarksService singleton. */
export const SERVICE = new BookmarksService();
