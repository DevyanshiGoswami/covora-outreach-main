import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { demoData, DEMO_DATE, DEMO_CLIENT } from "@/lib/demo";
import { parseSelection } from "@/lib/model";
import { demoConversations } from "@/lib/demo-conversations";

export const dynamic = "force-dynamic";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const selection = parseSelection(await searchParams);
  const data = demoData();
  const conversations = demoConversations(data, DEMO_CLIENT);
  return (
    <Dashboard
      data={data}
      workspace={{
        clientId: DEMO_CLIENT,
        clientName: "Example Company",
        role: "client_admin",
        clients: [],
        enabled: true,
      }}
      selection={selection}
      demo
      now={DEMO_DATE}
      conversations={conversations.page}
      demoConversations={conversations.details}
    />
  );
}
