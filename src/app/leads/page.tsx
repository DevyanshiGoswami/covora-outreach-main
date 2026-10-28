import Link from "next/link";
import { getWorkspace } from "@/lib/auth";
import { loadLeadDirectory } from "@/lib/leads-api";
import { parseLeadDirectoryQuery } from "@/lib/verified-leads";
import { loadLeadDirectoryPresentation } from "@/lib/lead-directory-presentation";
import { VerifiedLeads } from "@/components/verified-leads";
import { WorkspaceShell } from "@/components/workspace-shell";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspace(typeof params.client === "string" ? params.client : undefined);
  const query = parseLeadDirectoryQuery(params);
  const presentation = await loadLeadDirectoryPresentation(workspace, query, loadLeadDirectory);
  return <WorkspaceShell workspace={workspace} active="leads" title="Verified Leads" subtitle="Contacts, profiles, and outreach status." showPreviewNotice={false} showPreviewBadge={false}>
    {presentation && workspace.clientId
      ? <VerifiedLeads key={workspace.clientId} clientId={workspace.clientId} initialPage={presentation.page} query={query} />
      : <section className="panel empty-state"><h2>Workspace access required</h2><p>Your account manager can help you access the right company workspace.</p><Link className="text-link" href="/">Back to overview</Link></section>}
  </WorkspaceShell>;
}
