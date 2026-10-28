import { notFound } from "next/navigation";
import { SetupWorkspace } from "@/components/setup-workspace";
import { DEMO_CLIENT } from "@/lib/demo";

export const dynamic = "force-dynamic";
export default function DemoSettingsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const now = Date.parse("2026-10-03T12:00:00Z");
  return <SetupWorkspace demo now={now} accountData={{
    verificationAvailable: true, accounts: [
      { id: "10000000-0000-4000-8000-000000000031", client_id: DEMO_CLIENT, channel: "email", email: "alex@example.com", display_name: "Alex", state: "connected", last_checked_at: new Date(now - 3_600_000).toISOString(), last_attempt_at: new Date(now - 3_600_000).toISOString(), check_error: false, last_connected_at: new Date(now - 3_600_000).toISOString(), updated_at: new Date(now - 3_600_000).toISOString() },
      { id: "10000000-0000-4000-8000-000000000032", client_id: DEMO_CLIENT, channel: "email", email: "jordan@example.com", display_name: "Jordan", state: "unverified", last_checked_at: null, last_attempt_at: null, check_error: false, last_connected_at: null, updated_at: new Date(now).toISOString() },
    ]
  }} workspace={{ clientId: DEMO_CLIENT, clientName: "Example Company", role: "client_admin", clients: [], enabled: true }} requests={[
    { id: "10000000-0000-4000-8000-000000000021", client_id: DEMO_CLIENT, channel: "email", method: "assisted", status: "in_progress", note: "We’re reviewing your outreach inbox requirements. Your account manager will confirm the proposed domains and sender names with you.", created_at: "2026-10-02T10:00:00Z", updated_at: "2026-10-03T10:00:00Z" },
    { id: "10000000-0000-4000-8000-000000000022", client_id: DEMO_CLIENT, channel: "linkedin", method: "assisted", status: "requested", note: "", created_at: "2026-10-03T10:00:00Z", updated_at: "2026-10-03T10:00:00Z" },
  ]} />;
}
