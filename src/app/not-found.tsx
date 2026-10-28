import { APP_NAME } from "@/lib/config";
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">{APP_NAME.toUpperCase()}</span>
        <h1>Page not found.</h1>
        <p className="muted">This page is unavailable.</p>
        <Link className="text-link" href="/">
          Back to your workspace
        </Link>
      </section>
    </main>
  );
}
