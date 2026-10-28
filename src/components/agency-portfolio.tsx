"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowUpRight, BriefcaseBusiness, Building2, CheckCircle2, ChevronRight, ContactRound, Inbox, Layers3, LogOut, Mail, RefreshCw, Search, ShieldCheck, Users, Plug } from "lucide-react";
import type { AgencyPortfolioClient } from "@/lib/agency-portfolio";
import { canManageTeam } from "@/lib/team";
import { CovoraLogo } from "./covora-logo";
import { AgencyIntegrations } from "./agency-integrations";
import type { AdminIntegrationData } from "@/lib/admin-integrations";
import { SettingsDialog, SettingsTabs } from "./settings-dialog";
import { OnboardingForm } from "./onboarding-forms";
import { RemoveClientForm } from "./remove-client-form";
import { ThemeToggle } from "./controls";

const number = (value: number | null) => value === null ? "Unavailable" : value.toLocaleString("en-US");
const syncTime = (value: string) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
}).format(new Date(value));

function ClientCard({ client, onInvite, onRemove }: { client: AgencyPortfolioClient; onInvite?: () => void; onRemove?: () => void }) {
  const query = `client=${client.id}`;
  const preview = client.presentationMode === "preview";
  const initials = client.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  return <article className="agency-client-card">
    <div className="agency-card-heading">
      <span className="agency-avatar" aria-hidden="true">{initials}</span>
      <div><h2>{client.name}</h2><p>{client.role === "agency_owner" ? "Agency owner · Full workspace access" : "Assigned workspace"}</p></div>
      <span className={`agency-mode ${preview ? "is-preview" : ""}`}>{preview ? "Preview" : "Live workspace"}</span>
    </div>
    {preview ? <div className="agency-preview-description"><Layers3 size={20} aria-hidden="true" /><div><strong>Client preview</strong><p>Sample activity stays separate from live results. Imported leads remain available in the portal.</p></div></div>
      : <div className="agency-client-metrics">
        <div><span><Layers3 size={15} aria-hidden="true" />Active campaigns</span><strong>{number(client.activeCampaigns)}</strong></div>
        <div><span><Inbox size={15} aria-hidden="true" />Emails received</span><strong>{number(client.receivedEmails)}</strong><small>All time, including automated replies</small></div>
      </div>}
    {!preview && <p className="agency-sync-note">{client.unavailable ? "Some results could not be loaded. Refresh to try again." : client.activeCampaigns === 0 ? "No active campaigns in this workspace." : client.oldestCampaignSync ? <>Oldest active campaign sync: <time dateTime={client.oldestCampaignSync}>{syncTime(client.oldestCampaignSync)} UTC</time></> : "Campaign sync time is not available yet."}</p>}
    <nav className="agency-client-tools" aria-label={`${client.name} tools`}>
      <Link href={`/?${query}&view=inbox`} prefetch={false}><Inbox size={16} aria-hidden="true" />Inbox</Link>
      <Link href={`/leads?${query}`} prefetch={false}><ContactRound size={16} aria-hidden="true" />Verified leads</Link>
      <Link href={`/agency/leads?${query}&visibility=escrow`} prefetch={false}><Archive size={16} aria-hidden="true" />In escrow</Link>
      <Link href={`/agency/setup?${query}`} prefetch={false}><Mail size={16} aria-hidden="true" />Manage accounts</Link>
      {canManageTeam(client.role) && <Link href={`/settings/team?${query}`} prefetch={false}><Users size={16} aria-hidden="true" />Team</Link>}
    </nav>
    {(onInvite || onRemove) && <div className="onboarding-client-invite agency-client-actions">
      {onInvite && !preview && <button id={`invite-${client.id}`} className="settings-button" onClick={onInvite}>Invite client administrator</button>}
      {onRemove && <button id={`remove-${client.id}`} className="settings-button settings-button-danger" onClick={onRemove}>Remove client<span className="sr-only"> {client.name}</span></button>}
    </div>}
    <div className="agency-card-footer"><Link href={`/settings?${query}`} prefetch={false}>Account status<ChevronRight size={15} aria-hidden="true" /></Link><Link className="agency-open-client" href={`/?${query}&view=overview`} prefetch={false}>Open portal<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
  </article>;
}

export function AgencyPortfolio({ clients, isOwner = false, canManageClients = false, tab = "clients", integrations }: { clients: AgencyPortfolioClient[]; isOwner?: boolean; canManageClients?: boolean; tab?: "clients" | "integrations"; integrations?: AdminIntegrationData }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | AgencyPortfolioClient | null>(null);
  const [removing, setRemoving] = useState<AgencyPortfolioClient | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const [navigating, startNavigation] = useTransition();
  const [visibleTab, setVisibleTab] = useOptimistic(tab);
  const navigateTab = (next: "clients" | "integrations") => {
    if (next === visibleTab) return;
    startNavigation(() => {
      setVisibleTab(next);
      router.push(next === "integrations" ? "/agency?tab=integrations" : "/agency");
    });
  };
  const [search, setSearch] = useState("");
  const visible = clients.filter((client) => client.name.toLowerCase().includes(search.trim().toLowerCase()));
  const previews = clients.filter((client) => client.presentationMode === "preview").length;
  return <div className="agency-portal">
    <a className="skip-link" href="#agency-main">Skip to content</a>
    <aside className="agency-nav">
      <Link className="agency-brand" href="/agency"><CovoraLogo /><span>Covora</span></Link>
      <span className="agency-nav-label">AGENCY WORKSPACE</span>
      <nav aria-label="Agency navigation"><Link href="/agency" aria-current={visibleTab === "clients" ? "page" : undefined} onNavigate={event => { event.preventDefault(); navigateTab("clients"); }}><BriefcaseBusiness size={19} aria-hidden="true" />Clients<span>{clients.length}</span></Link>{isOwner && <><Link href="/agency?tab=integrations" aria-current={visibleTab === "integrations" ? "page" : undefined} onNavigate={event => { event.preventDefault(); navigateTab("integrations"); }}><Plug size={19} aria-hidden="true" />Integrations</Link><Link href="/agency/owners"><ShieldCheck size={19} aria-hidden="true" />Agency owners</Link></>}</nav>
      <div className="agency-nav-bottom"><div className="agency-private"><ShieldCheck size={19} aria-hidden="true" /><p>Private workspace<small>For your Covora team</small></p></div><div className="agency-session"><ThemeToggle placement="up" /><form action="/auth/signout" method="post"><button><LogOut size={16} aria-hidden="true" />Sign out</button></form></div></div>
    </aside>
    <div className="agency-body">
      <header className="agency-topbar"><span>Covora <ChevronRight size={14} aria-hidden="true" /><strong>Agency</strong></span><span>{isOwner ? <Link href="/agency/owners">Agency owners</Link> : <><ShieldCheck size={15} aria-hidden="true" />Authorized access</>}</span></header>
      <main id="agency-main" className="agency-main" tabIndex={-1}>
        <div className="agency-title"><div><span className="agency-eyebrow">YOUR OPERATIONS, IN ONE PLACE</span><h1>{visibleTab === "integrations" ? "Integrations" : "Agency workspace"}</h1><p>{visibleTab === "integrations" ? "Connect and manage your outreach services." : "Stay close to every client. Open their portal, review replies, and manage access."}</p></div><button className="agency-refresh" disabled={pending || navigating} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={16} className={pending ? "agency-spinning" : undefined} aria-hidden="true" />{pending ? "Refreshing" : "Refresh results"}</button></div>
        <p className="sr-only" role="status">{navigating ? "" : pending ? "Refreshing workspace results." : "Workspace results loaded."}</p>
        {isOwner && <div className="settings-toolbar agency-tabs"><SettingsTabs id="agency" label="Agency workspace sections" value={visibleTab} onChange={navigateTab} options={[{ value:"clients",label:"Clients" },{ value:"integrations",label:"Integrations" }]} /></div>}
        <div id="agency-panel" role={isOwner ? "tabpanel" : undefined} aria-labelledby={isOwner ? `agency-${visibleTab}` : undefined} aria-busy={navigating}>
        {navigating ? <div className="agency-client-card agency-tab-loading" role="status"><p>Loading {visibleTab === "integrations" ? "integrations" : "clients"}…</p></div> : tab === "integrations" && integrations ? <AgencyIntegrations data={integrations} /> : <>
        {notice && <p className="settings-feedback" role="status">{notice}</p>}
        {canManageClients && <div className="onboarding-actions"><button id="client-add" className="settings-button settings-button-primary" onClick={() => setDialog("create")}>Add client</button></div>}
        <div className="agency-summary">
          <div><Building2 size={19} aria-hidden="true" /><span>Client workspaces<strong>{clients.length}</strong></span></div>
          <div><CheckCircle2 size={19} aria-hidden="true" /><span>Live workspaces<strong>{clients.length - previews}</strong></span></div>
          <div><Layers3 size={19} aria-hidden="true" /><span>Client previews<strong>{previews}</strong></span></div>
        </div>
        <div className="agency-directory-heading"><div><h2>Your clients</h2><p>Live workspaces show saved results from the same data as each client portal.</p></div><label className="agency-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search clients</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" /></label></div>
        <div className="agency-client-grid">{visible.map((client) => <ClientCard key={client.id} client={client} onInvite={isOwner && client.role === "agency_owner" ? () => setDialog(client) : undefined} onRemove={canManageClients && client.role === "agency_owner" ? () => setRemoving(client) : undefined} />)}</div>
        {!visible.length && <div className="agency-no-results"><Search size={24} aria-hidden="true" /><h2>{clients.length ? "No clients match your search" : canManageClients ? "Add your first client" : "No client workspaces available"}</h2><p>{clients.length ? "Try another company name." : canManageClients ? "Create a workspace, invite the client administrator, then connect their accounts." : "Ask an owner with client-management permission to add a workspace."}</p><button onClick={() => setSearch("")}>Clear search</button></div>}
        </>}
        </div>
        <footer className="agency-footer"><span>Covora agency workspace</span><span>Showing only companies assigned to your account</span></footer>
      </main>
    </div>
    {dialog && <SettingsDialog title={dialog === "create" ? "Add a client" : "Invite client administrator"} description={dialog === "create" ? "Create a client workspace for outreach." : dialog.name} returnFocusId={dialog === "create" ? "client-add" : `invite-${dialog.id}`} onClose={() => setDialog(null)}><OnboardingForm kind={dialog === "create" ? "client" : "invite"} clientId={dialog === "create" ? undefined : dialog.id} onSaved={setNotice} onClose={() => setDialog(null)} /></SettingsDialog>}
    {removing && <SettingsDialog title="Remove client" description={removing.name} returnFocusId="client-add" onClose={() => setRemoving(null)}><RemoveClientForm client={removing} onSaved={setNotice} onClose={() => setRemoving(null)} /></SettingsDialog>}
  </div>;
}
