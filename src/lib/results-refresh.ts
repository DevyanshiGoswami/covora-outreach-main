import type { View } from "./model";

export const RESULTS_REFRESH_MS = 60_000;

export function refreshLiveResults(view: View, demo: boolean, preview: boolean): boolean {
  return !demo && !preview && ["overview", "campaigns", "linkedin"].includes(view);
}

export function pauseResultsRefresh(visible: boolean, editing: boolean): boolean {
  return !visible || editing;
}

/** The route transition owns completion; focus and timer events share one request. */
export function createResultsRefresher(deps: { paused: () => boolean; refresh: () => void }) {
  let running = false;
  let disposed = false;
  return {
    refresh() {
      if (disposed || running || deps.paused()) return;
      running = true;
      try {
        deps.refresh();
      } catch {
        running = false;
      }
    },
    settle() { running = false; },
    dispose() { disposed = true; },
  };
}
