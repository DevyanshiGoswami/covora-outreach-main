"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Search, ArrowUpRight, Send, Palette, Check } from "lucide-react";
import { NavigationLink as Link } from "./navigation-link";
import {
  CAMPAIGN_LABELS,
  LEAD_LABELS,
  percent,
  number,
  interestLabel,
} from "@/lib/metrics";
import { campaignMetric, campaignResultsLabel, reportedRate } from "@/lib/results-availability";
import type { Campaign, Lead, Selection, WorkspaceInfo } from "@/lib/model";
import { workspaceUrl } from "@/lib/navigation";

const TINTS = [
  { label: "Sage", color: "#6f9a6a" }, { label: "Mint", color: "#4fb39a" }, { label: "Teal", color: "#3c9aa0" },
  { label: "Sky", color: "#5b8fc7" }, { label: "Indigo", color: "#5f6fc9" }, { label: "Lavender", color: "#8e7cc3" },
  { label: "Lilac", color: "#b48ad0" }, { label: "Rose", color: "#d07a8c" }, { label: "Coral", color: "#e07a6a" },
  { label: "Peach", color: "#e39a6b" }, { label: "Sand", color: "#c9a46a" }, { label: "Lemon", color: "#cdb942" },
  { label: "Olive", color: "#9a9a5a" }, { label: "Stone", color: "#9a8f84" }, { label: "Slate", color: "#7a8799" },
] as const;
/** "light", "dark", or a tint written as "tint:#rrggbb". */
type Theme = string;
const THEME_KEY = "covora-outreach-theme";
const HEX = /^#[0-9a-f]{6}$/i;
const SURFACES = ["--bg", "--card", "--sidebar", "--border", "--input"] as const;
// Earlier saved names keep working.
const LEGACY: Record<string, string> = { sage: "#6f9a6a", sky: "#5b8fc7", sand: "#c9a46a", lavender: "#8e7cc3" };
const tintOf = (theme: Theme) => theme.startsWith("tint:") && HEX.test(theme.slice(5)) ? theme.slice(5).toLowerCase() : null;

/** Mixes the chosen color into a light surface; small weights keep text contrast close to the white theme. */
function mix(hex: string, base: string, weight: number) {
  const channel = (value: string, index: number) => parseInt(value.slice(1 + index * 2, 3 + index * 2), 16);
  return `#${[0, 1, 2].map(index => Math.round(channel(hex, index) * weight + channel(base, index) * (1 - weight)).toString(16).padStart(2, "0")).join("")}`;
}
function luminance(hex: string) {
  const [r, g, b] = [0, 1, 2].map(index => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
// Muted text (#626b79) needs a background at least this light to keep 4.5:1 contrast.
const MIN_SURFACE_LUMINANCE = .84;
function tintSurfaces(hex: string): Record<(typeof SURFACES)[number], string> {
  // Dark or saturated picks are diluted further until secondary text stays readable.
  let scale = 1;
  while (scale > .1 && luminance(mix(hex, "#f6f7f9", .16 * scale)) < MIN_SURFACE_LUMINANCE) scale -= .05;
  return { "--bg": mix(hex, "#f6f7f9", .16 * scale), "--card": mix(hex, "#ffffff", .035 * scale), "--sidebar": mix(hex, "#fbfbfc", .09 * scale), "--border": mix(hex, "#e4e7ec", .22 * scale), "--input": "#ffffff" };
}
function subscribeTheme(callback: () => void) {
  window.addEventListener("outreach-theme-change", callback);
  return () => window.removeEventListener("outreach-theme-change", callback);
}
function currentTheme(): Theme {
  const root = document.documentElement;
  return root.dataset.theme === "tint" && root.dataset.tint && HEX.test(root.dataset.tint) ? `tint:${root.dataset.tint}` : root.dataset.theme === "dark" ? "dark" : "light";
}
function applyTheme(theme: Theme, remember = true) {
  const root = document.documentElement, tint = tintOf(theme);
  if (tint) {
    root.dataset.theme = "tint";
    root.dataset.tint = tint;
    for (const [name, value] of Object.entries(tintSurfaces(tint))) root.style.setProperty(name, value);
  } else {
    root.dataset.theme = theme === "dark" ? "dark" : "light";
    delete root.dataset.tint;
    for (const name of SURFACES) root.style.removeProperty(name);
  }
  // A display preference only; storage may be unavailable and the page still works without it.
  if (remember) try { localStorage.setItem(THEME_KEY, tint ? `tint:${tint}` : root.dataset.theme); } catch { }
  window.dispatchEvent(new Event("outreach-theme-change"));
}
export function ThemeToggle({ placement = "down" }: { placement?: "up" | "down" }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light");
  const tint = tintOf(theme);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { }
    const theme = saved && LEGACY[saved] ? `tint:${LEGACY[saved]}` : saved;
    if (theme && (theme === "light" || theme === "dark" || tintOf(theme)) && theme !== currentTheme()) applyTheme(theme, false);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const dark = theme === "dark";
  return <div className="theme-controls" ref={menu}>
    <button type="button" className="icon-button" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={() => applyTheme(dark ? "light" : "dark")}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
    <button type="button" className="icon-button" aria-label="Choose background color" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}><Palette size={18} /></button>
    {open && <div id={menuId} className="theme-menu" data-placement={placement} role="group" aria-label="Background color">
      <div className="theme-base-options">
        {(["light", "dark"] as const).map(value => <button key={value} type="button" className="theme-swatch" aria-pressed={theme === value} onClick={() => { applyTheme(value); setOpen(false); }}>
          <span aria-hidden="true" style={{ background: value === "light" ? "#ffffff" : "#1a202b" }} />{value === "light" ? "White" : "Dark"}{theme === value && <Check size={14} aria-hidden="true" />}
        </button>)}
      </div>
      <p className="theme-menu-label">Tints</p>
      <div className="theme-palette">
        {TINTS.map(option => <button key={option.color} type="button" className="theme-dot" title={option.label} aria-label={option.label} aria-pressed={tint === option.color} style={{ background: mix(option.color, "#ffffff", .45) }} onClick={() => applyTheme(`tint:${option.color}`)}>
          {tint === option.color && <Check size={13} aria-hidden="true" />}
        </button>)}
      </div>
      <label className="theme-custom">
        <input type="color" value={tint ?? "#5b8fc7"} onChange={event => applyTheme(`tint:${event.target.value}`)} />
        <span>Any color…<small>Softened so text stays readable</small></span>
        {tint && !TINTS.some(option => option.color === tint) && <Check size={14} aria-hidden="true" />}
      </label>
    </div>}
  </div>;
}
export function ClientSwitcher({
  workspace,
  selection,
  demo,
}: {
  workspace: WorkspaceInfo;
  selection: Selection;
  demo: boolean;
}) {
  const router = useRouter();
  return (
    <label className="client-switcher">
      <span>Client workspace</span>
      <select
        aria-label="Client workspace"
        value={workspace.clientId || ""}
        onChange={(e) =>
          router.push(
            workspaceUrl(
              selection,
              { client: e.target.value, campaign: "", view: "overview" },
              demo,
            ),
          )
        }
      >
        {!workspace.clientId && <option value="">Choose a client</option>}
        {workspace.clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function CampaignTable({
  campaigns,
  selection,
  demo,
  compact = false,
  activeOnly = false,
}: {
  campaigns: Campaign[];
  selection: Selection;
  demo: boolean;
  compact?: boolean;
  activeOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const filtered = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      (activeOnly || !status || c.status === status),
  );
  return (
    <>
      {!compact && (
        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search campaigns"
              placeholder="Search campaigns"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {!activeOnly && <select
            aria-label="Campaign status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[...new Set(campaigns.map((c) => c.status))].map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_LABELS[s] || "Unknown"}
              </option>
            ))}
          </select>}
        </div>
      )}
      <div className="table-scroll">
        <table className="campaign-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Reach</th>
              <th>Contacted</th>
              <th>Replies</th>
              <th>Reply rate</th>
              <th>Opportunities</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const contacted = campaignMetric(c, "contacted");
              const replies = campaignMetric(c, "replies");
              const opportunities = campaignMetric(c, "opportunities");
              const reach = reportedRate(contacted, campaignMetric(c, "leads"));
              const replyRate = reportedRate(replies, contacted);
              return (
              <tr key={c.id}>
                <td>
                  <div className="campaign-identity"><span className="campaign-emblem" aria-hidden="true"><Send size={17} /></span><div><Link
                    className="campaign-name"
                    href={workspaceUrl(
                      selection,
                      { view: "campaigns", campaign: c.id, tab: "analytics" },
                      demo,
                    )}
                  >
                    {c.name}
                  </Link>
                  <small>{campaignResultsLabel(c) || "Email campaign"}</small></div></div>
                </td>
                <td>
                  <span
                    className={`status ${c.status === "active" ? "status-green" : c.status === "completed" ? "status-blue" : ""}`}
                  >
                    <i />
                    {CAMPAIGN_LABELS[c.status] || "Unknown"}
                  </span>
                </td>
                <td>
                  <div className="progress-cell">
                    <span>
                      {reach === null ? "—" : percent(reach)}
                    </span>
                    {reach !== null && <div className="progress">
                      <i
                        style={{
                          width: percent(reach),
                        }}
                      />
                    </div>}
                  </div>
                </td>
                <td>{contacted === null ? "—" : number(contacted)}</td>
                <td>{replies === null ? "—" : number(replies)}</td>
                <td>
                  {replyRate === null ? "—" : percent(replyRate)}
                </td>
                <td>{opportunities === null ? "—" : number(opportunities)}</td>
                <td>
                  <Link
                    className="icon-button"
                    aria-label={`View ${c.name}`}
                    href={workspaceUrl(
                      selection,
                      { view: "campaigns", campaign: c.id, tab: "analytics" },
                      demo,
                    )}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h3>
            {campaigns.length
              ? "No matching campaigns"
              : activeOnly ? "No active campaigns right now" : "Your campaigns will appear here"}
          </h3>
          <p>
            {campaigns.length
              ? activeOnly ? "Try a different search." : "Try a different search or status."
              : activeOnly ? "Active campaigns will appear here after the next sync. Previous conversations and verified leads remain available." : "Once your team connects a campaign, you can follow its progress here."}
          </p>
        </div>
      )}
    </>
  );
}
export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const filtered = leads.filter(
    (l) =>
      `${l.first_name || ""} ${l.last_name || ""} ${l.email} ${l.company || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || l.status === status),
  );
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search leads"
            placeholder="Search name, email, or company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Lead status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[...new Set(leads.map((l) => l.status))].map((s) => (
            <option key={s} value={s}>
              {LEAD_LABELS[s] || "Unknown"}
            </option>
          ))}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Status</th>
              <th>Last step</th>
              <th>Interest</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>
                    {[l.first_name, l.last_name].filter(Boolean).join(" ") ||
                      l.email}
                  </strong>
                  <small>{l.email}</small>
                </td>
                <td>{l.company || "—"}</td>
                <td>
                  <span
                    className={`status ${l.status === "replied" ? "status-blue" : ""}`}
                  >
                    {LEAD_LABELS[l.status] || "Unknown"}
                  </span>
                </td>
                <td>{l.last_step ? `Step ${l.last_step}` : "—"}</td>
                <td>{interestLabel(l.interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h3>No leads to show</h3>
          <p>
            {leads.length
              ? "Try another search or status."
              : "Lead results will appear after the next sync."}
          </p>
        </div>
      )}
    </>
  );
}
