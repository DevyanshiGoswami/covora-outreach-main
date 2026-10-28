import { notFound } from "next/navigation";
import { DEMO_CLIENT } from "@/lib/demo";
import { demoLeadDirectory } from "@/lib/demo-verified-leads";
import { parseLeadDirectoryQuery } from "@/lib/verified-leads";
import { VerifiedLeads } from "@/components/verified-leads";
import { WorkspaceShell } from "@/components/workspace-shell";

export const dynamic = "force-dynamic";

export default async function DemoLeadsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = parseLeadDirectoryQuery(await searchParams);
  const page = demoLeadDirectory(DEMO_CLIENT, query);
  return <WorkspaceShell demo workspace={{ clientId: DEMO_CLIENT, clientName: "Example Company", role: "client_admin", clients: [], enabled: true }} active="leads" title="Verified Leads" subtitle="Your campaign leads, contact details, and outreach progress.">
    <VerifiedLeads demo clientId={DEMO_CLIENT} initialPage={page} query={query} />
  </WorkspaceShell>;
}
