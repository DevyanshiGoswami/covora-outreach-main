"use client";

import { useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { Archive, ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Search, ShieldCheck, Users } from "lucide-react";
import { escrowHref, type EscrowPage, type EscrowQuery } from "@/lib/lead-escrow";
import { leadEmailLabel } from "@/lib/verified-leads";
import { CovoraLogo } from "./covora-logo";
import { ThemeToggle } from "./controls";
import "./lead-escrow.css";

export function LeadEscrow({ company, data, query }: { company: string; data: EscrowPage; query: EscrowQuery }) {
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  const number = (value: number) => value.toLocaleString("en-US");
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const clear = escrowHref(data.clientId, { q: "", page: 1 });
  const clientHref = `/leads?client=${data.clientId}`;
  async function copy(value: string, id: string) {
    try { await navigator.clipboard.writeText(value); setCopied(id); setNotice("Email copied."); }
    catch { setNotice("Could not copy. Select the email text to copy it."); }
  }
  return <div className="escrow-workspace">
    <a className="skip-link" href="#escrow-main">Skip to content</a>
    <header className="escrow-topbar"><Link className="escrow-brand" href="/agency"><CovoraLogo /><span>Covora</span></Link><span className="escrow-private"><ShieldCheck size={16} aria-hidden="true" />Agency only</span><ThemeToggle /></header>
    <main id="escrow-main" className="escrow-main" tabIndex={-1}>
      <Link className="escrow-back" href="/agency"><ArrowLeft size={15} aria-hidden="true" />Admin workspace</Link>
      <div className="escrow-heading"><div><p>{company}</p><h1>In escrow</h1><span>Contacts held for further research. These do not appear in the client portal.</span></div><Link className="escrow-client-link" href={clientHref}>View client leads<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <dl className="escrow-summary"><div><Archive size={20} aria-hidden="true" /><dt>In escrow</dt><dd>{number(data.summary.escrow)}</dd></div><div><Users size={20} aria-hidden="true" /><dt>Visible to client</dt><dd>{number(data.summary.clientVisible)}</dd></div></dl>
      <section className="escrow-card" aria-label="Held contacts">
        <Form action="/agency/leads" className="escrow-search" scroll={false} prefetch={false}>
          <input type="hidden" name="client" value={data.clientId} /><input type="hidden" name="visibility" value="escrow" />
          <label htmlFor="escrow-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search escrow contacts</span><input id="escrow-search" type="search" name="q" defaultValue={query.q} maxLength={200} placeholder="Search name, company, or email" /></label>
          <button type="submit">Search</button>{query.q && <Link href={clear} scroll={false}>Clear</Link>}
        </Form>
        <div className="escrow-table-caption"><h2>{query.q ? "Matching contacts" : "Held contacts"} <span>{number(data.total)}</span></h2><p>Open a name to review the details</p></div>
        {notice && <p className="escrow-notice" role="status">{notice}</p>}
        <div className="escrow-table-scroll" tabIndex={0} role="region" aria-label="Escrow contacts, scroll horizontally for all columns">
          <table className="escrow-table"><caption className="sr-only">Contacts held privately for further investigation</caption><thead><tr><th scope="col">Contact</th><th scope="col">Company / role</th><th scope="col">Email</th><th scope="col">LinkedIn</th><th scope="col">Review reason</th></tr></thead><tbody>
            {data.leads.map((lead) => <tr key={lead.id}><td><details className="escrow-details"><summary>{lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Name unavailable"}</summary><dl><dt>Lead list</dt><dd>{lead.listName || "Imported contacts"}</dd><dt>Location</dt><dd>{lead.location || "Not provided"}</dd><dt>Review reason</dt><dd>{lead.reviewReason || "Further research required"}</dd>{lead.fitReason && <><dt>Fit research</dt><dd>{lead.fitReason}</dd></>}{lead.researchGaps && <><dt>Research gaps</dt><dd>{lead.researchGaps}</dd></>}{lead.reviewedAt && <><dt>Reviewed</dt><dd><time dateTime={lead.reviewedAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(lead.reviewedAt))}</time></dd></>}</dl></details><span className="escrow-state">In escrow</span></td>
              <td><strong>{lead.company || "Not provided"}</strong><small>{lead.jobTitle || "Role not provided"}</small></td>
              <td>{lead.email ? <><div className="escrow-email"><span>{lead.email}</span><button type="button" title="Copy email" aria-label={`Copy email for ${lead.fullName}`} onClick={() => void copy(lead.email!, lead.id)}>{copied === lead.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button></div><small>{leadEmailLabel(lead)}</small></> : <small>No email</small>}</td>
              <td>{lead.linkedinUrl ? <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">View profile<ExternalLink size={13} aria-hidden="true" /></a> : <small>No profile</small>}</td>
              <td><p className="escrow-reason">{lead.reviewReason || "Further research required"}</p></td>
            </tr>)}
          </tbody></table>
        </div>
        {!data.leads.length && <div className="escrow-empty"><Archive size={26} aria-hidden="true" /><h3>{query.q ? "No matching contacts" : "No contacts in escrow"}</h3><p>{query.q ? "Try another search or clear the search." : "Contacts held for review will appear here."}</p>{query.q && <Link href={clear}>Clear search</Link>}</div>}
        <footer className="escrow-pagination"><p>{number(data.total ? (data.page - 1) * data.pageSize + 1 : 0)}–{number(Math.min(data.page * data.pageSize, data.total))} of {number(data.total)} contacts</p><nav aria-label="Escrow pages">{data.page > 1 ? <Link href={escrowHref(data.clientId, { ...query, page: data.page - 1 })} scroll={false} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></Link> : <button disabled aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>}<span>Page {number(data.page)} of {number(pages)}</span>{data.page < pages ? <Link href={escrowHref(data.clientId, { ...query, page: data.page + 1 })} scroll={false} aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></Link> : <button disabled aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></button>}</nav></footer>
      </section>
    </main>
  </div>;
}
