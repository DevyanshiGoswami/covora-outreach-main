import { Dashboard } from "@/components/dashboard";
import { getWorkspace } from "@/lib/auth";
import { loadResults } from "@/lib/data";
import { parseSelection } from "@/lib/model";
import { loadConversations } from "@/lib/conversations-api";
import { workspacePreview } from "@/lib/workspace-preview";
import { loadWorkspacePresentation } from "@/lib/workspace-presentation";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const selection = parseSelection(await searchParams);
  const returnTo = selection.view === "inbox" ? `/?client=${selection.client}&view=inbox` : "/";
  const workspace = await getWorkspace(selection.client, false, returnTo);
  const presentation = await loadWorkspacePresentation(workspace, selection, {
    preview: workspacePreview,
    results: () => loadResults(workspace, selection),
    conversations: () => loadConversations(workspace.clientId!),
  });
  return <Dashboard data={presentation.data} workspace={workspace} selection={{ ...selection, client: workspace.clientId || "" }}
    now={presentation.asOf ?? new Date().toISOString()} preview={presentation.preview}
    conversations={presentation.conversations} conversationError={presentation.conversationError} demoConversations={presentation.sampleConversations} />;
}
