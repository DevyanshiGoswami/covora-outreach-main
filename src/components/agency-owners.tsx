"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, BriefcaseBusiness, LogOut, Plug } from "lucide-react";
import { CovoraLogo } from "./covora-logo";
import { ThemeToggle } from "./controls";
import { inviteOwner, revokeOwnerAccess } from "@/app/agency/owners/actions";
import { ownerInvitationLink, type OwnerList } from "@/lib/owners";
export function AgencyOwners({ data }: { data: OwnerList }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  function revoke(id: string, version: number, invitation = false) {
    if (
      !window.confirm(
        invitation
          ? "Revoke this owner invitation?"
          : "Remove agency owner access? Any separate client membership remains unchanged.",
      )
    )
      return;
    start(async () => {
      setError("");
      const result = await revokeOwnerAccess(id, version, invitation);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }
  return (
    <div className="agency-portal">
      <aside className="agency-nav">
        <Link className="agency-brand" href="/agency">
          <CovoraLogo />
          <span>Covora</span>
        </Link>
        <span className="agency-nav-label">AGENCY WORKSPACE</span>
        <nav aria-label="Agency navigation">
          <Link href="/agency">
            <BriefcaseBusiness size={19} />
            Clients
          </Link>
          <Link href="/agency?tab=integrations"><Plug size={19} aria-hidden="true" />Integrations</Link>
          <Link href="/agency/owners" aria-current="page">
            <ShieldCheck size={19} />
            Agency owners
          </Link>
        </nav>
        <div className="agency-nav-bottom">
          <div className="agency-session">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button>
                <LogOut size={16} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="agency-body"><header className="agency-topbar"><Link href="/agency">Clients</Link><Link href="/agency?tab=integrations">Integrations</Link><strong>Agency owners</strong></header>
      <main className="agency-main agency-owners">
        <div className="agency-title">
          <div>
            <h1>Agency owners</h1>
            <p>
              Owners can access all enabled client workspaces, manage access,
              and invite other owners.
            </p>
          </div>
        </div>
        <section className="agency-client-card">
          <h2>Invite an agency owner</h2>
          <p>
            Enter the email they will use to sign in. Share the private link
            directly with that person. No email is sent automatically.
          </p>
          <form
            className="login-form"
            action={(form) => {
              const email = String(form.get("email") ?? "");
              start(async () => {
                setError("");
                setLink("");
                setNotice("");
                setCopied(false);
                const result = await inviteOwner(email);
                if (result.error) setError(result.error);
                else if (result.invitation) {
                  const i = result.invitation;
                  setLink(
                    ownerInvitationLink(
                      window.location.origin,
                      i.token,
                      i.loginToken,
                    ),
                  );
                  setNotice(
                    i.accountStatus === "new"
                      ? "They can activate their account and choose a password. The activation step may expire before the seven-day owner invitation; ask for a fresh link if needed."
                      : i.accountStatus === "existing"
                        ? "They already have a login. They must sign in with their existing password and accept owner access."
                        : "The owner invitation was created, but account activation could not be prepared. Existing users can sign in; new users need a reissued link after account setup is available.",
                  );
                  router.refresh();
                }
              });
            }}
          >
            <label className="settings-field">
              Email address
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <button
              className="settings-button settings-button-primary"
              disabled={pending}
            >
              {pending ? "Working…" : "Create owner invitation"}
            </button>
          </form>
          {link && (
            <div>
              <p role="status">{notice}</p>
              <label className="settings-field">
                Private invitation link
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <button
                className="settings-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError("Select and copy the link manually.");
                  }
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <p>
                This link is shown only now. Creating another invitation for the
                same email replaces the previous one.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
        </section>
        <section className="agency-client-card">
          <h2>Owners</h2>
          {data.owners.map((o) => (
            <div className="agency-card-footer" key={o.userId}>
              <div>
                <strong>
                  {o.email}
                  {o.userId === data.userId ? " · You" : ""}
                </strong>
                <p>Agency owner · {o.state}</p>
              </div>
              {data.canRemoveOwners && o.state !== "revoked" && (
                <button
                  className="settings-button"
                  disabled={
                    pending ||
                    (o.state === "active" &&
                      data.owners.filter((x) => x.state === "active").length ===
                        1)
                  }
                  onClick={() => revoke(o.userId, o.version)}
                >
                  Remove owner access
                </button>
              )}
            </div>
          ))}
        </section>
        <section className="agency-client-card">
          <h2>Invitations</h2>
          {!data.invitations.length && <p>No owner invitations yet.</p>}
          {data.invitations.map((i) => (
            <div className="agency-card-footer" key={i.id}>
              <div>
                <strong>{i.email}</strong>
                <p>
                  {i.status} · Expires{" "}
                  {new Date(i.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {i.status === "pending" && (
                <button
                  className="settings-button"
                  disabled={pending}
                  onClick={() => revoke(i.id, 1, true)}
                >
                  Revoke invitation
                </button>
              )}
            </div>
          ))}
        </section>
      </main></div>
    </div>
  );
}
