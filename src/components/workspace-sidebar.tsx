"use client";

import { useState, type ReactNode } from "react";
import { NavigationLink as Link } from "./navigation-link";
import { useRouter } from "next/navigation";
import { BadgeCheck, BarChart3, BriefcaseBusiness, ChevronDown, ContactRound, Inbox, Layers3, LogIn, LogOut, Mail, Menu, MessageSquare, Network, Users, X } from "lucide-react";
import { agencyWorkspaces, type Workspace } from "@/lib/access";
import { hasComments } from "@/lib/comments";
import { canManageTeam, ROLE_LABELS } from "@/lib/team";
import { ThemeToggle } from "./controls";
import { CovoraLogo } from "./covora-logo";
import type { WorkspacePage } from "./workspace-shell";

function pageUrl(page: WorkspacePage, client: string | null, demo: boolean) {
  const query = new URLSearchParams();
  if (client) query.set("client", client);
  const base = demo ? "/demo" : "";
  const path = page === "comments" ? "/comments" : page === "leads" ? `${base}/leads` : page === "accounts" ? `${base}/settings` : page === "team" ? `${base}/settings/team` : page === "agency" ? "/agency" : `${base}/`;
  if (["overview", "campaigns", "inbox", "linkedin"].includes(page)) query.set("view", page);
  return `${path}${query.size ? `?${query}` : ""}`;
}

export function WorkspaceSidebar({ workspace, active, demo, inboxBadge }: {
  workspace: Workspace; active: WorkspacePage; demo: boolean; inboxBadge?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const agency = agencyWorkspaces(workspace.clients);
  const choices = active === "agency" ? agency : workspace.clients;
  const companyBadge = workspace.clientId === "a2bb9be7-018a-4750-97a0-28e48bbb18b9"
    ? <BadgeCheck className="app-company-badge" size={16} aria-hidden="true" />
    : null;
  const items: { key: WorkspacePage; label: string; icon: typeof Inbox }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "campaigns", label: "Campaigns", icon: Layers3 },
    { key: "inbox", label: "Inbox", icon: Inbox },
    { key: "leads", label: "Verified Leads", icon: ContactRound },
    { key: "linkedin", label: "LinkedIn", icon: Network },
    ...(!demo && hasComments(workspace.clientId) ? [{ key: "comments" as const, label: "Comments", icon: MessageSquare }] : []),
    { key: "accounts", label: "Accounts", icon: Mail },
    ...(demo || canManageTeam(workspace.role) ? [{ key: "team" as const, label: "Team", icon: Users }] : []),
    ...(!demo && agency.length ? [{ key: "agency" as const, label: "Agency workspace", icon: BriefcaseBusiness }] : []),
  ];
  return <aside className="app-sidebar" data-open={open}>
    <div className="app-sidebar-top">
      <Link className="app-brand" href={pageUrl("overview", workspace.clientId, demo)}><CovoraLogo />Covora</Link>
      <button className="app-mobile-toggle" aria-label={open ? "Close navigation" : "Open navigation"} aria-controls="workspace-menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    <div id="workspace-menu" className="app-sidebar-menu">
      <div className="app-company">
        {choices.length > 1 ? <label><span className="sr-only">Company workspace</span><select className={companyBadge ? "has-company-badge" : undefined} aria-label="Company workspace" value={workspace.clientId ?? ""} onChange={(event) => {
          const choice = choices.find((client) => client.id === event.target.value);
          if (!choice) return;
          const next = (active === "team" && !canManageTeam(choice.role)) || (active === "comments" && !hasComments(choice.id)) ? "overview" : active;
          router.push(pageUrl(next, choice.id, demo));
          setOpen(false);
        }}>{!workspace.clientId && <option value="">Choose a company</option>}{choices.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>{companyBadge}<ChevronDown aria-hidden="true" size={16} /></label> : <span className="app-company-name"><span>{workspace.clientName}</span>{companyBadge}</span>}
      </div>
      {workspace.role && <p className="app-workspace-role">{workspace.role === "agency_owner" ? "Agency owner" : ROLE_LABELS[workspace.role]}</p>}
      <nav className="app-nav" aria-label="Workspace navigation">
        {items.map((item) => <Link key={item.key} href={pageUrl(item.key, item.key === "agency" ? (agency.find((c) => c.id === workspace.clientId) ?? agency[0])?.id ?? null : workspace.clientId, demo)} aria-current={active === item.key ? "page" : undefined} onClick={() => setOpen(false)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span>{item.key === "inbox" && inboxBadge}</Link>)}
      </nav>
      <div className="app-sidebar-bottom"><ThemeToggle placement="up" />{demo ? <Link href="/login" className="app-signout"><LogIn size={16} aria-hidden="true" />Sign in</Link> : <form action="/auth/signout" method="post"><button className="app-signout"><LogOut size={16} aria-hidden="true" />Sign out</button></form>}</div>
    </div>
  </aside>;
}
