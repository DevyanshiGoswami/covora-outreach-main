import { isPreviewWorkspace, type Workspace } from "./access";
import { EMPTY_DATA, type ResultsData, type Selection } from "./model";
import { loadInboxData } from "./inbox-loading";
import type { ConversationDetail, ConversationPage } from "./conversations";
import type { WorkspacePreview } from "./workspace-preview";

export type WorkspacePresentation = {
  data: ResultsData;
  conversations: ConversationPage | null;
  conversationError?: string;
  sampleConversations?: ConversationDetail[];
  preview: boolean;
  asOf?: string;
};

/** Preview results never fall through to live reads, including missing preview configuration. */
export async function loadWorkspacePresentation(workspace: Workspace, selection: Selection, loaders: {
  preview: (workspace: Workspace) => WorkspacePreview | null;
  results: () => Promise<ResultsData>;
  conversations: () => Promise<ConversationPage>;
}): Promise<WorkspacePresentation> {
  if (isPreviewWorkspace(workspace)) {
    const preview = loaders.preview(workspace);
    return {
      data: preview?.data ?? EMPTY_DATA, conversations: preview?.conversations ?? { conversations: [], nextCursor: null },
      sampleConversations: preview?.details ?? [], preview: true, asOf: preview?.asOf,
    };
  }
  if (!workspace.enabled || !workspace.clientId) return { data: EMPTY_DATA, conversations: null, preview: false };
  const live = selection.view === "inbox"
    ? await loadInboxData(loaders.results, loaders.conversations)
    : { data: await loaders.results(), conversations: null, conversationError: undefined };
  return { ...live, preview: false };
}
