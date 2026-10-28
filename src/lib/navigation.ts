import type { Selection } from "./model";
export function workspaceUrl(
  selection: Selection,
  changes: Partial<Selection>,
  demo: boolean,
) {
  const next = { ...selection, ...changes };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next))
    if (value) query.set(key, value);
  return `${demo ? "/demo" : "/"}?${query}`;
}
