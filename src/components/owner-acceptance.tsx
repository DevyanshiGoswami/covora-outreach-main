"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  captureOwnerInvitation,
  ownerStorageKey,
  type OwnerSession,
  type OwnerOffer,
} from "@/lib/owners";
import {
  inspectOwnerInvitation,
  activateOwnerAccount,
  saveOwnerPassword,
  acceptOwnerInvitation,
} from "@/app/owner-invite/actions";
export function OwnerAcceptance({
  authenticated,
  projectUrl,
}: {
  authenticated: boolean;
  projectUrl: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<OwnerSession>({ token: "" });
  const [offer, setOffer] = useState<OwnerOffer>();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const current = useRef("");
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const seq = ++sequence;
      setLoaded(false);
      setOffer(undefined);
      setError("");
      setDone(false);
      try {
        let value: OwnerSession;
        try {
          value = captureOwnerInvitation(
            window.location.hash,
            window.sessionStorage,
            (path) => window.history.replaceState(null, "", path),
            projectUrl,
          );
        } finally {
          if (window.location.hash)
            window.history.replaceState(null, "", "/owner-invite");
        }
        current.current = value.token;
        const result: { invitation?: OwnerOffer; error?: string } =
          authenticated && value.token
            ? await inspectOwnerInvitation(value.token)
            : {};
        if (active && seq === sequence) {
          setState(value);
          setOffer(result.invitation);
          setError(result.error ?? "");
          setLoaded(true);
        }
      } catch {
        if (active) {
          setError(
            "Allow tab storage, then reopen the private invitation link.",
          );
          setLoaded(true);
        }
      }
    }
    const changed = () => {
      current.current = "";
      void load();
    };
    void load();
    window.addEventListener("hashchange", changed);
    return () => {
      active = false;
      window.removeEventListener("hashchange", changed);
    };
  }, [authenticated, projectUrl]);
  function store(value: OwnerSession) {
    window.sessionStorage.setItem(
      ownerStorageKey(projectUrl),
      JSON.stringify(value),
    );
    setState(value);
  }
  const signout = (
    <form action="/auth/signout?next=/owner-invite" method="post">
      <button className="quiet-button" disabled={pending}>
        Sign out and use another account
      </button>
    </form>
  );
  if (done)
    return (
      <div className="invitation-content">
        <h1>Agency owner access is active</h1>
        <p>You can manage owners and access all enabled client workspaces.</p>
        <Link className="primary" href="/agency/owners">
          Open agency workspace
        </Link>
      </div>
    );
  if (!loaded) return <p role="status">Checking invitation…</p>;
  if (!state.token)
    return (
      <div className="invitation-content">
        <h1>Open your invitation</h1>
        <p role="alert">
          {error || "Use the complete private link shared by an agency owner."}
        </p>
      </div>
    );
  return (
    <div className="invitation-content">
      <h1>Agency owner invitation</h1>
      <p>
        Agency owners can access all enabled clients, manage access, and invite
        other owners.
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!authenticated ? (
        <>
          {state.loginToken && (
            <>
              <p>
                Activate your account, then choose your own password. Your
                sign-in email is the one used for this invitation.
              </p>
              <button
                className="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const token = state.token;
                    setError("");
                    try {
                      store({ ...state, needsPassword: true });
                      const result = await activateOwnerAccount(
                        state.loginToken!,
                      );
                      if (current.current !== token) return;
                      if (result.error) setError(result.error);
                      else {
                        store({ token, needsPassword: true });
                        router.refresh();
                      }
                    } catch {
                      setError(
                        "Activation could not be confirmed. Reload to check your session.",
                      );
                    }
                  })
                }
              >
                {pending ? "Activating…" : "Activate my account"}
              </button>
            </>
          )}
          <Link className="secondary" href="/login?next=/owner-invite">
            Sign in with an existing account
          </Link>
        </>
      ) : offer ? (
        <>
          <p>
            Invited email: <strong>{offer.email}</strong>
          </p>
          <p>
            Invitation expires {new Date(offer.expiresAt).toLocaleDateString()}.
          </p>
          {state.needsPassword ? (
            <form
              className="login-form"
              action={(form) => {
                const password = String(form.get("password") ?? "");
                if (password !== form.get("confirmPassword")) {
                  setError("Passwords do not match.");
                  return;
                }
                start(async () => {
                  const token = state.token;
                  try {
                    const result = await saveOwnerPassword(token, password);
                    if (current.current !== token) return;
                    if (result.error) setError(result.error);
                    else {
                      store({ token });
                      setError("");
                    }
                  } catch {
                    setError(
                      "Password save could not be confirmed. Try again.",
                    );
                  }
                });
              }}
            >
              <label className="settings-field">
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <label className="settings-field">
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <button className="primary" disabled={pending}>
                Save password
              </button>
            </form>
          ) : (
            <>
              <button
                className="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const token = state.token;
                    try {
                      const result = await acceptOwnerInvitation(token);
                      if (current.current !== token) return;
                      if (result.error) setError(result.error);
                      else {
                        window.sessionStorage.removeItem(
                          ownerStorageKey(projectUrl),
                        );
                        current.current = "";
                        setDone(true);
                      }
                    } catch {
                      setError(
                        "Acceptance could not be confirmed. Refresh to check access.",
                      );
                    }
                  })
                }
              >
                {pending
                  ? "Confirming…"
                  : offer.status === "accepted"
                    ? "Continue to agency"
                    : "Accept agency owner access"}
              </button>
              {offer.status === "pending" && (
                <button
                  className="quiet-button"
                  disabled={pending}
                  onClick={() => {
                    try {
                      store({ ...state, needsPassword: true });
                    } catch {
                      setError("Allow tab storage to continue.");
                    }
                  }}
                >
                  Set a password for this account
                </button>
              )}
            </>
          )}
          {signout}
        </>
      ) : (
        signout
      )}
    </div>
  );
}
