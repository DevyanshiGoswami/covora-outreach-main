import { adminIntegrationsFromResponse, type AdminIntegrationData } from "@/lib/admin-integrations";
import { getAgencyAccess, callOnboardingApi } from "@/lib/onboarding-api";
import { notFound } from "next/navigation";
import { AgencyPortfolio } from "@/components/agency-portfolio";
import { getWorkspace } from "@/lib/auth";
import { authorizedAgencyClients, readAgencyPortfolio } from "@/lib/agency-portfolio";
import { createClient } from "@/lib/supabase/server";
import "@/components/agency-portfolio.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agency workspace · Covora" };

export default async function AgencyPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // A requested company must pass the same current membership check as every other route.
  const requested = typeof params.client === "string" ? params.client : undefined;
  const [workspace, access] = await Promise.all([
    getWorkspace(requested, true, "/agency"),
    getAgencyAccess(),
  ]);
  if (!authorizedAgencyClients(workspace).length && !access.isOwner) notFound();
  const tab = params.tab === "integrations" ? "integrations" : "clients";
  if (tab === "integrations" && !access.isOwner) notFound();
  let integrations: AdminIntegrationData | undefined;
  if (tab === "integrations") {
    try { integrations = { integrations: adminIntegrationsFromResponse(await callOnboardingApi("admin-integrations")) }; }
    catch { integrations = { integrations: [], error: "Integrations could not be loaded. Refresh to try again." }; }
  }
  // The connector screen needs the authorized directory count, not card metrics.
  const clients = await readAgencyPortfolio(await createClient(), workspace, { includeMetrics: tab === "clients" });
  return <AgencyPortfolio clients={clients} isOwner={access.isOwner} canManageClients={access.canManageClients} tab={tab} integrations={integrations} />;
}
