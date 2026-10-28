import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/auth";
import { canReadEscrow, parseEscrowQuery } from "@/lib/lead-escrow";
import { loadEscrow } from "@/lib/lead-escrow-api";
import { LeadEscrow } from "@/components/lead-escrow";

export const dynamic = "force-dynamic";
export const metadata = { title: "In escrow · Covora" };

export default async function EscrowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.client !== undefined && typeof params.client !== "string") notFound();
  const requested = typeof params.client === "string" ? params.client : undefined;
  const workspace = await getWorkspace(requested, true, "/agency");
  if (!workspace.clientId || !canReadEscrow(workspace, workspace.clientId) || (params.visibility !== undefined && params.visibility !== "escrow")) notFound();
  const query = parseEscrowQuery(params);
  const page = await loadEscrow(workspace, query);
  return <LeadEscrow key={`${workspace.clientId}:${JSON.stringify(query)}`} company={workspace.clientName} data={page} query={query} />;
}
