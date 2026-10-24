import { useEffect, useState } from "react";
import { loadLibraryBrowseState, saveLibraryBrowseState } from "../utils/libraryBrowseState";

/** The page is keyed by rootId, so each work has an independent browsing session. */
export function useLibraryBrowseState(rootId: string) {
  const [state, setState] = useState(() => loadLibraryBrowseState(rootId, sessionStorage));
  useEffect(() => { saveLibraryBrowseState(rootId, state, sessionStorage); }, [rootId, state]);
  return [state, setState] as const;
}
