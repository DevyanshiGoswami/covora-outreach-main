import { notFound } from "next/navigation";
import { TeamWorkspace } from "@/components/team-workspace";
import { DEMO_CLIENT } from "@/lib/demo";
import type { TeamData } from "@/lib/team";

export const dynamic = "force-dynamic";
const sampleTeam: TeamData = {
  members: [
    { client_id: DEMO_CLIENT, user_id: "20000000-0000-4000-8000-000000000001", email: "alex@example.com", role: "client_admin", state: "active", version: 1 },
    { client_id: DEMO_CLIENT, user_id: "20000000-0000-4000-8000-000000000002", email: "jordan@example.com", role: "client_member", state: "active", version: 2 },
    { client_id: DEMO_CLIENT, user_id: "20000000-0000-4000-8000-000000000003", email: "sam@example.com", role: "client_viewer", state: "active", version: 1 },
    { client_id: DEMO_CLIENT, user_id: "20000000-0000-4000-8000-000000000004", email: "taylor@example.com", role: "client_member", state: "suspended", version: 3 },
  ],
  invitations: [
    { id: "30000000-0000-4000-8000-000000000001", client_id: DEMO_CLIENT, email: "morgan@example.com", role: "client_member", status: "pending", created_at: "2026-10-03T10:00:00Z", expires_at: "2026-10-10T10:00:00Z" },
    { id: "30000000-0000-4000-8000-000000000002", client_id: DEMO_CLIENT, email: "casey@example.com", role: "client_viewer", status: "expired", created_at: "2026-09-20T10:00:00Z", expires_at: "2026-09-27T10:00:00Z" },
  ],
};
export default function DemoTeamPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TeamWorkspace demo workspace={{ clientId: DEMO_CLIENT, clientName: "Example Company", role: "client_admin", clients: [], enabled: true }} data={sampleTeam} />;
}
