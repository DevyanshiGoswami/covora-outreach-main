"use client";
import { useSearchParams } from "next/navigation";

export default function LeadsError({ reset }: { reset: () => void }) {
  const params = useSearchParams();
  const client = params.get("client");
  const clearHref = client && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client)
    ? `/leads?client=${encodeURIComponent(client)}` : "/leads";
  return <main className="login-page"><section className="login-card" role="alert">
    <h1>Your leads couldn’t be loaded.</h1>
    <p className="muted">Try again in a moment. Your saved leads have not changed.</p>
    <button className="primary" onClick={reset}>Try again</button>
    <a className="text-link" href={clearHref}>Clear filters</a>
  </section></main>;
}
