import { APP_NAME } from "@/lib/config";
export default function Loading() {
  return (
    <main className="loading-layout" aria-live="polite" aria-busy="true">
      <span className="eyebrow">{APP_NAME.toUpperCase()}</span>
      <p className="muted">Loading your results…</p>
      <div className="loading-block" />
      <div className="loading-block" />
    </main>
  );
}
