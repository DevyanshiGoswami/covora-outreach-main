"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUp, BadgeCheck, BriefcaseBusiness, Building2, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FilterX, LoaderCircle, Network, Mail, MapPin, Search, Users, X } from "lucide-react";
import { EPM_LEADS_CLIENT_ID, LEAD_AUDIENCES, LEAD_AUDIENCE_LABELS, LEAD_STATUS_LABELS, changeLeadAudience, leadLocationDisplay, leadEmailLabel, leadEmailValidationNote, leadLinkedInFirst, leadDirectoryHref, parseLeadDirectoryQuery, safeLeadLinkedInUrl, type LeadDirectoryLead, type LeadDirectoryPage, type LeadDirectoryQuery } from "@/lib/verified-leads";
import "./verified-leads.css";

type Props = { clientId: string; initialPage: LeadDirectoryPage; query: LeadDirectoryQuery; demo?: boolean };
type Navigation = {
  pending: boolean;
  pendingQuery: LeadDirectoryQuery;
  navigate: (href: string) => void;
  navigation: (href: string) => (event: { preventDefault: () => void }) => void;
};

export function VerifiedLeads(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingQuery, setPendingQuery] = useOptimistic(props.query);
  function navigate(href: string) {
    const nextQuery = parseLeadDirectoryQuery(new URL(href, window.location.origin).searchParams);
    startTransition(() => {
      setPendingQuery(nextQuery);
      router.push(href, { scroll: false });
    });
  }
  function navigation(href: string) {
    return (event: { preventDefault: () => void }) => { event.preventDefault(); navigate(href); };
  }
  // Keep navigation state across query updates, while resetting the form and profile.
  return <LeadDirectory key={`${props.clientId}:${JSON.stringify(props.query)}`} {...props} pending={pending} pendingQuery={pendingQuery} navigate={navigate} navigation={navigation} />;
}

function LeadDirectory({ clientId, initialPage, query, demo = false, pending, pendingQuery, navigate, navigation }: Props & Navigation) {
  const [selection, setSelected] = useState<LeadDirectoryLead | null>(null);
  const selected = pending ? null : selection;
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const { leads, total, page, pageSize, summary, companies, campaigns, lists } = initialPage;
  const audienceEnabled = clientId === EPM_LEADS_CLIENT_ID && initialPage.audienceEnabled === true;
  const locationOptions = initialPage.locationOptions ?? { states: [], cities: [] };
  const hasFilters = Boolean(query.q || query.company || query.campaign || query.list || query.city || query.state || query.role !== "all" || query.email !== "all" || query.linkedin !== "all" || query.status !== "all");
  const clearHref = leadDirectoryHref(clientId, { ...parseLeadDirectoryQuery({}), audience: query.audience }, demo);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const number = (value: number) => value.toLocaleString("en-US");
  const sortHref = (sort: LeadDirectoryQuery["sort"]) => leadDirectoryHref(clientId, { ...query, page: 1, sort }, demo);
  const shownStart = total ? (page - 1) * pageSize + 1 : 0;
  const shownEnd = Math.min(page * pageSize, total);

  async function copy(value: string, label: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setNotice(`${label} copied.`);
    } catch {
      setCopied("");
      setNotice(`Could not copy ${label.toLowerCase()}. Select the text in the lead details to copy it.`);
    }
  }

  function copyButton(value: string, label: string, key: string) {
    return <button type="button" className="lead-copy" aria-label={`Copy ${label.toLowerCase()}`} title={`Copy ${label.toLowerCase()}`} onClick={() => void copy(value, label, key)}>
      {copied === key ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>;
  }

  return <section className="lead-directory" aria-label="Verified leads directory">
    {audienceEnabled && <nav className="lead-audiences" aria-label="Contact category">{LEAD_AUDIENCES.map((audience) => {
      const href = leadDirectoryHref(clientId, changeLeadAudience(query, audience), demo);
      return <Link key={audience} href={href} scroll={false} prefetch={audience !== query.audience} onNavigate={navigation(href)} aria-current={pendingQuery.audience === audience ? "page" : undefined}>{LEAD_AUDIENCE_LABELS[audience]}</Link>;
    })}</nav>}
    <div className={`lead-navigation-status${pending ? " lead-navigation-pending" : ""}`} role="status" aria-live="polite">{pending && <><LoaderCircle size={15} aria-hidden="true" /><span>{pendingQuery.audience !== query.audience ? `Loading ${LEAD_AUDIENCE_LABELS[pendingQuery.audience].toLowerCase()}` : "Updating leads"}. Previous results are shown until the update is ready.</span></>}</div>
    <dl className="lead-summary" aria-label="Workspace lead totals">
      {[{ label: "Leads", value: summary.total, icon: Users }, { label: "Verified emails", value: summary.verifiedEmail, icon: BadgeCheck }, { label: "LinkedIn profiles", value: summary.withLinkedIn, icon: Network }, { label: "Companies", value: summary.companies, icon: Building2 }].map(({ label, value, icon: Icon }) => <div key={label} className="lead-summary-item">
        <dt><Icon size={15} aria-hidden="true" />{label}</dt><dd>{number(value)}</dd>
      </div>)}
    </dl>

    <div className="lead-directory-card">
      <Form className="lead-filters" action={demo ? "/demo/leads" : "/leads"} scroll={false} aria-label="Filter leads" inert={pending} aria-busy={pending} onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const values = new FormData(event.currentTarget);
        const params: Record<string, string> = {};
        for (const [key, value] of values.entries()) if (typeof value === "string") params[key] = value;
        navigate(leadDirectoryHref(clientId, parseLeadDirectoryQuery(params), demo));
      }}>
        <input type="hidden" name="client" value={clientId} />
        {audienceEnabled && <input type="hidden" name="audience" value={query.audience} />}
        <div className={`lead-filter-primary${lists.length ? " lead-filter-primary-with-list" : ""}${hasFilters ? " lead-filter-primary-with-clear" : ""}`}>
          <div className="lead-search">
            <label htmlFor="lead-search" className="lead-sr-only">Search leads</label>
            <Search size={17} aria-hidden="true" />
            <input id="lead-search" type="search" name="q" defaultValue={query.q} maxLength={200} placeholder="Search name, company, or email…" />
            <button type="submit">Search</button>
          </div>
          {lists.length > 0 && <label className="lead-filter lead-list-filter"><span>Lead list</span><select name="list" defaultValue={query.list} onChange={(event) => event.currentTarget.form?.requestSubmit()}><option value="">All lead lists</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name || "Untitled list"}</option>)}</select></label>}
          {hasFilters && <Link href={clearHref} className="lead-clear lead-clear-active" scroll={false} onNavigate={navigation(clearHref)}><FilterX size={15} aria-hidden="true" />Clear</Link>}
        </div>
        {audienceEnabled && <div className="lead-location-filters" aria-label="Person location filters">
          <label className="lead-filter"><span>Person state</span><select name="state" defaultValue={query.state} onChange={(event) => { const form = event.currentTarget.form; const city = form?.elements.namedItem("city"); if (city instanceof HTMLSelectElement) city.value = ""; form?.requestSubmit(); }}>
            <option value="">All states</option>{query.state && !locationOptions.states.some((option) => option.value === query.state) && <option value={query.state}>Selected state</option>}{locationOptions.states.map((option) => <option key={option.value} value={option.value}>{option.label} ({number(option.count)})</option>)}
          </select></label>
          <label className="lead-filter"><span>Person city</span><select name="city" defaultValue={query.city} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="">All cities</option>{query.city && !locationOptions.cities.some((option) => option.value === query.city) && <option value={query.city}>Selected city</option>}{locationOptions.cities.map((option) => <option key={option.value} value={option.value}>{option.label} ({number(option.count)})</option>)}
          </select></label>
          <p>Filter by the person’s recorded city and state. Incomplete or conflicting locations stay visible in the full list.</p>
        </div>}
        <div className="lead-filter-secondary">
          <label className="lead-filter"><span>Role</span><select name="role" defaultValue={query.role} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="all">All roles</option><option value="owners-executives">Owners & executives</option><option value="vp-director">VP / Head / Director</option><option value="manager-other">Manager / Other</option>
          </select></label>
          <label className="lead-filter"><span>Company</span><select name="company" defaultValue={query.company} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="">All companies</option>{companies.map((company) => <option key={company} value={company}>{company}</option>)}
          </select></label>
          <label className="lead-filter"><span>Campaign</span><select name="campaign" defaultValue={query.campaign} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name || "Untitled campaign"}</option>)}
          </select></label>
          <label className="lead-filter"><span>Email</span><select name="email" defaultValue={query.email} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="all">Any email status</option><option value="available">Email available</option><option value="verified">Verified email only</option>
          </select></label>
          <label className="lead-filter"><span>LinkedIn</span><select name="linkedin" defaultValue={query.linkedin} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="all">Any profile status</option><option value="available">Profile available</option><option value="verified">Confirmed profile only</option>
          </select></label>
          <label className="lead-filter"><span>Outreach</span><select name="status" defaultValue={query.status} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="all">Any outreach status</option><option value="not_contacted">Not contacted</option><option value="contacted">Contacted</option><option value="replied">Replied</option><option value="completed">Completed</option>
          </select></label>
          <label className="lead-filter"><span>Sort by</span><select aria-label="Sort by" name="sort" defaultValue={query.sort} onChange={(event) => event.currentTarget.form?.requestSubmit()}><option value="priority">Best fit first</option><option value="company">Company</option><option value="name">Name</option><option value="role">Role</option></select></label>
          {initialPage.filterOptionsTruncated && <p className="lead-filter-note">Use search to find leads beyond the listed filters.</p>}
        </div>
      </Form>

      <div className="lead-table-toolbar">
        <div><h2>{audienceEnabled ? LEAD_AUDIENCE_LABELS[query.audience] : "All leads"}</h2><span className="lead-result-count">{number(total)}</span>{hasFilters && <span className="lead-filtered-label">matching filters</span>}</div>
        <span className="lead-table-hint">View research for assessment and notes</span>
      </div>
      {notice && <p className="lead-notice" role="status">{notice}</p>}
      <div className="lead-table-scroll" role="region" aria-label="Lead table, scroll horizontally for more columns" tabIndex={0} aria-busy={pending} inert={pending}>
        <table className="lead-table">
          <caption className="lead-sr-only">Leads with contact information, verification, and outreach status</caption>
          <colgroup><col className="lead-col-company" /><col className="lead-col-name" /><col className="lead-col-role" /><col className="lead-col-email" /><col className="lead-col-linkedin" /><col className="lead-col-location" /><col className="lead-col-campaign" /><col className="lead-col-status" /></colgroup>
          <thead><tr>
            <th scope="col" aria-sort={query.sort === "company" ? "ascending" : "none"}><Link href={sortHref("company")} scroll={false} onNavigate={navigation(sortHref("company"))}><Building2 size={13} aria-hidden="true" />Company{query.sort === "company" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDownAZ size={12} aria-hidden="true" />}</Link></th>
            <th scope="col" aria-sort={query.sort === "name" ? "ascending" : "none"}><Link href={sortHref("name")} scroll={false} onNavigate={navigation(sortHref("name"))}><Users size={13} aria-hidden="true" />Name{query.sort === "name" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDownAZ size={12} aria-hidden="true" />}</Link><span className="lead-th-secondary">Research and notes</span></th>
            <th scope="col" aria-sort={query.sort === "role" ? "ascending" : "none"}><Link href={sortHref("role")} scroll={false} onNavigate={navigation(sortHref("role"))}><BriefcaseBusiness size={13} aria-hidden="true" />Role{query.sort === "role" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDownAZ size={12} aria-hidden="true" />}</Link></th>
            <th scope="col" className="lead-th-email"><span><Mail size={13} aria-hidden="true" />Email</span></th>
            <th scope="col" className="lead-th-linkedin"><span><Network size={13} aria-hidden="true" />LinkedIn</span></th>
            <th scope="col"><span><MapPin size={13} aria-hidden="true" />Location</span></th>
            <th scope="col">Campaign / list</th><th scope="col">Outreach</th>
          </tr></thead>
          <tbody>{leads.map((lead) => {
            const name = lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Name unavailable";
            const profile = safeLeadLinkedInUrl(lead.linkedinUrl);
            const open = selected?.id === lead.id;
            const location = leadLocationDisplay(lead);
            const emailVerified = lead.emailVerification === "verified";
            return <tr key={lead.id} className={open ? "lead-row lead-row-selected" : "lead-row"}>
                <td className="lead-company-cell">{lead.priorityRank && <span className="lead-rank">Priority #{lead.priorityRank}</span>}<span className="lead-company" title={lead.company || undefined}>{lead.company || <span className="lead-missing">Not provided</span>}</span></td>
                <td><button type="button" className="lead-name-button" disabled={pending} aria-haspopup="dialog" aria-controls={open ? "lead-profile-panel" : undefined} aria-label={`View details for ${name}`} onClick={() => setSelected(lead)}><span className="lead-monogram" aria-hidden="true">{initials(lead)}</span><span title={name}>{name}</span><ChevronRight size={13} aria-hidden="true" /></button><div className="lead-research-preview"><p>{lead.fitReason || lead.researchGaps || "Research not available yet"}</p><button type="button" disabled={pending} aria-haspopup="dialog" aria-label={`View research for ${name}`} onClick={() => setSelected(lead)}>View research<ChevronRight size={12} aria-hidden="true" /></button></div></td>
                <td><span className="lead-cell-text" title={lead.jobTitle || undefined}>{lead.jobTitle || <span className="lead-missing">Not provided</span>}</span></td>
                <td className="lead-email-cell">{lead.email ? <><div className="lead-contact-value"><span title={lead.email}>{lead.email}</span>{copyButton(lead.email, `Email for ${name}`, `${lead.id}-email`)}</div><span className={`lead-contact-badge${emailVerified ? " lead-badge-verified" : ""}`} title={leadEmailValidationNote(lead)}>{emailVerified && <BadgeCheck size={12} aria-hidden="true" />}{leadEmailLabel(lead)}</span></> : <span className="lead-missing">No email</span>}</td>
                <td className="lead-linkedin-cell">{profile ? <><a href={profile} target="_blank" rel="noopener noreferrer" className="lead-profile" aria-label={`Open ${name}'s LinkedIn profile`}><Network size={14} aria-hidden="true" />View profile<ExternalLink size={12} aria-hidden="true" /></a><span className={`lead-contact-badge${lead.linkedinVerified === true ? " lead-badge-verified" : ""}`}>{lead.linkedinVerified === true && <BadgeCheck size={12} aria-hidden="true" />}{lead.linkedinVerified === true ? "Confirmed" : "Profile available"}</span>{leadLinkedInFirst(lead) && <span className="lead-contact-badge lead-channel-first">LinkedIn first</span>}</> : <span className="lead-missing">No profile</span>}</td>
                <td><span className="lead-cell-text" title={location.note}>{location.label}</span></td>
                <td><span className="lead-cell-text" title={lead.campaignName || lead.listName || undefined}>{lead.campaignName || lead.listName || (lead.listId ? "Untitled list" : "Untitled campaign")}</span></td>
                <td><span className={`lead-outreach-badge lead-outreach-${lead.status}`}><span aria-hidden="true" />{LEAD_STATUS_LABELS[lead.status]}</span></td>
              </tr>;
          })}</tbody>
        </table>
      </div>
      {leads.length === 0 && <div className="lead-empty" aria-busy={pending} inert={pending}><Users size={27} aria-hidden="true" /><h3>{hasFilters ? "No leads match these filters" : audienceEnabled && query.audience === "athletes" ? "No athletes added yet" : "Your leads will appear here"}</h3><p>{hasFilters ? "Try another search or clear the filters to see your full list." : audienceEnabled && query.audience === "athletes" ? "Athlete profiles will appear here when they are reviewed and added. Athlete outreach uses LinkedIn only." : "Once leads are added to your workspace, you can explore their details and contact information here."}</p>{hasFilters && <Link href={clearHref} scroll={false} onNavigate={navigation(clearHref)}>Clear filters<ChevronRight size={15} aria-hidden="true" /></Link>}</div>}
      <footer className="lead-pagination" inert={pending}><p aria-live="polite">{number(shownStart)} to {number(shownEnd)} of {number(total)} leads</p><nav aria-label="Lead pages">
        {page > 1 ? <Link href={leadDirectoryHref(clientId, { ...query, page: page - 1 }, demo)} scroll={false} onNavigate={navigation(leadDirectoryHref(clientId, { ...query, page: page - 1 }, demo))} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></Link> : <button type="button" disabled aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>}
        <span>Page {number(page)} of {number(pageCount)}</span>
        {page < pageCount ? <Link href={leadDirectoryHref(clientId, { ...query, page: page + 1 }, demo)} scroll={false} onNavigate={navigation(leadDirectoryHref(clientId, { ...query, page: page + 1 }, demo))} aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></Link> : <button type="button" disabled aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></button>}
      </nav></footer>
    </div>
    <p className="lead-verification-note"><BadgeCheck size={14} aria-hidden="true" />Verification reflects the recorded email check. Contact roles and company details can change.</p>
    {selected && <LeadProfilePanel lead={selected} onClose={() => setSelected(null)} copyButton={copyButton} notice={notice} />}
  </section>;
}

function initials(lead: LeadDirectoryLead) {
  return (lead.firstName.slice(0, 1) + lead.lastName.slice(0, 1)).toUpperCase() || lead.fullName.split(/\s+/).map((part) => part.slice(0, 1)).slice(0, 2).join("").toUpperCase() || "C";
}

function LeadProfilePanel({ lead, onClose, copyButton, notice }: { lead: LeadDirectoryLead; onClose: () => void; copyButton: (value: string, label: string, key: string) => ReactNode; notice: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    panel?.showModal();
    document.body.style.overflow = "hidden";
    return () => { panel?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  const name = lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Contact details";
  const profile = safeLeadLinkedInUrl(lead.linkedinUrl);
  const location = leadLocationDisplay(lead);
  const date = (value: string) => <time dateTime={value}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))}</time>;
  return <dialog id="lead-profile-panel" ref={dialog} className="lead-profile-panel" aria-labelledby="lead-profile-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="lead-profile-panel-content">
      <header className="lead-panel-heading"><span>Research and notes</span><button type="button" aria-label="Close contact profile" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      <div className="lead-profile-identity"><span className="lead-monogram" aria-hidden="true">{initials(lead)}</span><h2 id="lead-profile-title">{name}</h2><p>{lead.jobTitle || "Role not provided"}</p><strong>{lead.company || "Company not provided"}</strong></div>
      <section className="lead-profile-summary" aria-labelledby="lead-profile-summary-title"><h3 id="lead-profile-summary-title">Contact and company summary</h3><p>{lead.fitReason || "Summary not available yet"}</p></section>
      {lead.researchGaps && <section className="lead-profile-section"><h3>Research notes</h3><p>{lead.researchGaps}</p></section>}
      {lead.icebreaker && <section className="lead-profile-section"><h3>Personal opener</h3><p>{lead.icebreaker}</p><small>Draft for review before outreach</small></section>}
      <dl className="lead-profile-facts">
        <div><dt>Email</dt><dd>{lead.email || "Not provided"}{lead.email && copyButton(lead.email, `Email for ${name}`, `${lead.id}-email`)}<small>{lead.email ? leadEmailLabel(lead) : "No email on this lead"}</small>{lead.email && leadEmailValidationNote(lead) && <small>{leadEmailValidationNote(lead)}</small>}</dd></div>
        <div><dt>LinkedIn profile</dt><dd>{profile ? <><a href={profile} target="_blank" rel="noopener noreferrer">View profile<ExternalLink size={13} aria-hidden="true" /></a>{copyButton(profile, `LinkedIn profile for ${name}`, `${lead.id}-linkedin`)}<small>{lead.linkedinVerified === true ? "Profile confirmed" : "Profile verification has not been confirmed"}</small></> : "Not provided"}</dd></div>
        <div><dt>Location</dt><dd>{location.label}<small>{location.note}</small></dd></div>
        <div><dt>Outreach status</dt><dd>{LEAD_STATUS_LABELS[lead.status]}{lead.interest && <small>{lead.interest}</small>}</dd></div>
        {lead.listId && <div><dt>Lead list</dt><dd>{lead.listName || "Untitled list"}</dd></div>}
        {lead.campaignId && <div><dt>Campaign</dt><dd>{lead.campaignName || "Untitled campaign"}</dd></div>}
        <div><dt>Last activity</dt><dd>{lead.lastActivityAt ? date(lead.lastActivityAt) : "No activity recorded"}</dd></div>
      </dl>
      {lead.researchedAt && <section className="lead-profile-section"><h3>Research checked</h3><p>{date(lead.researchedAt)}</p><small>Source information may be older</small></section>}
      {Boolean(lead.sourceUrls?.length) && <section className="lead-profile-section"><h3>Research sources</h3>{lead.sourceUrls?.map((url, index) => <a className="lead-source-link" key={url} href={url} target="_blank" rel="noopener noreferrer">Source {index + 1}: {new URL(url).hostname}<ExternalLink size={12} aria-hidden="true" /></a>)}</section>}
      {notice && <p className="lead-panel-notice" role="status">{notice}</p>}
    </div>
  </dialog>;
}
