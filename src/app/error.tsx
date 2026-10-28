"use client";
import { APP_NAME } from "@/lib/config";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">{APP_NAME.toUpperCase()}</span>
        <h1>Let’s try that again.</h1>
        <p className="muted">
          Your results could not be loaded. Try again in a moment, or contact
          your account manager if this continues.
        </p>
        <button className="primary" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
