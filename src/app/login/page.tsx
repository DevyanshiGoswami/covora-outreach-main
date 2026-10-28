import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChartNoAxesCombined, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { isAuthConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeLoginNext } from "@/lib/invitation-session";
import { ThemeToggle } from "@/components/controls";
import { CovoraLogo } from "@/components/covora-logo";
import { LoginForm } from "./login-form";
import "./login.css";

export const dynamic = "force-dynamic";
export const metadata = { title: `Sign in · ${APP_NAME}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeLoginNext((await searchParams).next);
  const configured = isAuthConfigured();
  let authenticated = false;
  if (configured) {
    try {
      const client = await createClient();
      const { data: { user }, error } = await client.auth.getUser();
      authenticated = !error && Boolean(user);
    } catch {
      // The form provides a retryable error when the sign-in service is unavailable.
    }
  }
  if (authenticated) redirect(next);
  return (
    <main className="portal-login">
      <header className="portal-login-header">
        <Link className="brand" href="/" aria-label={APP_NAME}>
          <CovoraLogo />
          <span>{APP_NAME}</span>
        </Link>
        <div className="portal-login-header-end"><span>Client portal</span><ThemeToggle /></div>
      </header>
      <div className="portal-login-layout">
        <section className="portal-login-intro" aria-labelledby="login-intro-title">
          <span className="portal-login-label">YOUR COVORA WORKSPACE</span>
          <h2 id="login-intro-title">Your outreach.<br /><span>One clear view.</span></h2>
          <p>Campaigns, conversations, and results. Everything you need to stay close to your next opportunity.</p>
          <ul className="portal-login-benefits">
            <li><ChartNoAxesCombined size={20} aria-hidden="true" /><span>See how your campaigns are performing</span></li>
            <li><MessagesSquare size={20} aria-hidden="true" /><span>Reply across email and LinkedIn</span></li>
            <li><Users size={20} aria-hidden="true" /><span>Work alongside your Covora team</span></li>
          </ul>
          <div className="portal-login-private"><ShieldCheck size={17} aria-hidden="true" /> A private workspace for your company.</div>
        </section>
        <section className="portal-login-card" aria-labelledby="login-title">
          <span className="portal-login-label">LET’S GET YOU BACK IN</span>
          <h1 id="login-title">Welcome back.</h1>
          <p className="portal-login-description">Sign in with your email and password.</p>
          {!configured && (
            <p className="notice" role="status">
              Your workspace is being connected. Sign-in will be available once setup is complete.
            </p>
          )}
          <LoginForm configured={configured} next={next} />
          <p className="portal-login-help">
            Need access or a password reset?<br />Contact your Covora account manager.
          </p>
        </section>
      </div>
      <footer className="portal-login-footer">
        <span>{APP_NAME} <span aria-hidden="true">·</span> Your outreach, together.</span>
        {process.env.NODE_ENV === "development" && <Link href="/demo">View sample workspace <ArrowUpRight size={14} aria-hidden="true" /></Link>}
      </footer>
    </main>
  );
}
