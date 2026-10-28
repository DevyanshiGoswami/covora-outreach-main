"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signIn, type LoginState } from "./actions";
import type { LoginDestination } from "@/lib/invitation-session";

export function LoginForm({ configured, next = "/" }: { configured: boolean; next?: LoginDestination }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [state, action, pending] = useActionState(signIn, {
    error: null,
  } as LoginState);
  return (
    <form action={action} className="login-form" onSubmit={() => setPasswordVisible(false)} aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      <div className="form-field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={state.error ? "login-error" : undefined}
          placeholder="you@company.com"
          required
          maxLength={254}
          disabled={!configured || pending}
        />
      </div>
      <div className="form-field">
        <label htmlFor="password">Password</label>
        <div className="login-password-field">
        <input
          id="password"
          name="password"
          type={passwordVisible ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={state.error ? "login-error" : undefined}
          placeholder="Your password"
          required
          maxLength={1024}
          disabled={!configured || pending}
        />
        <button type="button" className="login-password-toggle" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-controls="password" aria-pressed={passwordVisible} disabled={!configured || pending} onClick={() => setPasswordVisible((visible) => !visible)}>
          {passwordVisible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
        </div>
      </div>
      {state.error && (
        <p className="notice login-error" id="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="primary"
        type="submit"
        disabled={!configured || pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <LoaderCircle size={17} aria-hidden="true" /> Signing in…
          </>
        ) : (
          <>
            Sign in to your workspace <ArrowRight size={17} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
