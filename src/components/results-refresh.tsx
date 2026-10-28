"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createResultsRefresher, pauseResultsRefresh, RESULTS_REFRESH_MS } from "@/lib/results-refresh";

/** Mounted only on live result pages, never on a conversation or setup surface. */
export function ResultsRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresher = useRef<ReturnType<typeof createResultsRefresher> | null>(null);

  useEffect(() => {
    const current = createResultsRefresher({
      paused: () => pauseResultsRefresh(document.visibilityState === "visible", Boolean(
        document.activeElement?.closest("input, textarea, select, [contenteditable=true]") ||
        document.querySelector("dialog[open], [role=dialog]"),
      )),
      refresh: () => startTransition(() => router.refresh()),
    });
    refresher.current = current;
    const refresh = () => current.refresh();
    const timer = window.setInterval(refresh, RESULTS_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      current.dispose();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      refresher.current = null;
    };
  }, [router]);

  useEffect(() => {
    if (!pending) refresher.current?.settle();
  }, [pending]);

  return null;
}
