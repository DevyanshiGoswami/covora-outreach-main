"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ReadState = {
  readIds: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
};
const ReadContext = createContext<ReadState | null>(null);

/** Demo reads survive view navigation while the workspace shell remains mounted. */
export function ReadStateProvider({ children }: { children: ReactNode }) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const markRead = useCallback((ids: string[]) => {
    setReadIds((previous) => {
      if (ids.every((id) => previous.has(id))) return previous;
      return new Set([...previous, ...ids]);
    });
  }, []);
  const value = useMemo(() => ({ readIds, markRead }), [readIds, markRead]);
  return <ReadContext.Provider value={value}>{children}</ReadContext.Provider>;
}

export function useDemoReadState(): ReadState {
  const state = useContext(ReadContext);
  if (!state) throw new Error("Read state must be used within its workspace.");
  return state;
}

export function UnreadBadge({ count, demo }: { count: number; demo: boolean }) {
  const { readIds } = useDemoReadState();
  const unread = Math.max(0, count - (demo ? readIds.size : 0));
  if (!unread) return null;
  return (
    <span
      className="nav-count"
      aria-label={`${unread} unread ${unread === 1 ? "message" : "messages"}`}
    >
      {unread}
    </span>
  );
}
