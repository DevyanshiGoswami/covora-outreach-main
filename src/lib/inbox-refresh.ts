import type { ConversationDetail, ConversationFilter, ConversationPage } from "./conversations";
import { replyIsUnresolved, type ReplyDraft } from "./reply-draft";

export const INBOX_REFRESH_MS = 60_000;

export function pauseInboxRefresh(visible: boolean, pending: boolean, editing: boolean, draft?: ReplyDraft): boolean {
  return !visible || pending || editing || Boolean(draft && (draft.text.length || replyIsUnresolved(draft)));
}

/** Keep loaded history; restart pagination at the fresh page so new arrivals cannot create a gap. */
export function mergeRefreshedConversations(previous: ConversationPage, fresh: ConversationPage): ConversationPage {
  if (!fresh.nextCursor) return fresh;
  const updated = new Map(fresh.conversations.map(item => [item.id, item]));
  return { ...fresh, conversations: [...fresh.conversations, ...previous.conversations.filter(item => !updated.has(item.id))] };
}

type Snapshot = { channel: ConversationFilter; selected: string | null; selectedVersion: number; selectionRequest: number; listRequest: number; paused: boolean };
type Result<T> = { data?: T; error?: string };

/** Read-only refreshes never share the selection path that marks a conversation read. */
export function createInboxRefresher(deps: {
  snapshot: () => Snapshot;
  list: (channel: ConversationFilter) => Promise<Result<ConversationPage>>;
  detail: (id: string) => Promise<Result<ConversationDetail>>;
  applyPage: (page: ConversationPage) => void;
  applyDetail: (detail: ConversationDetail) => void;
  detailFailed: (id: string) => void;
  failed: () => void;
}) {
  let running = false, disposed = false;
  return {
    async refresh() {
      const before = deps.snapshot();
      if (disposed || running || before.paused) return;
      running = true;
      const current = () => {
        const after = deps.snapshot();
        return !disposed && !after.paused && before.channel === after.channel && before.selected === after.selected
          && before.selectionRequest === after.selectionRequest && before.listRequest === after.listRequest;
      };
      try {
        const [pageResult, detailResult] = await Promise.allSettled([deps.list(before.channel), before.selected ? deps.detail(before.selected) : undefined]);
        if (!current()) return;
        const page = pageResult.status === "fulfilled" ? pageResult.value?.data : undefined;
        const detail = detailResult.status === "fulfilled" ? detailResult.value?.data : undefined;
        if (page) deps.applyPage(page); else deps.failed();
        if (before.selected) {
          const listed = page?.conversations.find(item => item.id === before.selected);
          const minimumVersion = Math.max(before.selectedVersion, listed?.version || 0);
          // List and detail are independent snapshots; never roll newer authority/history back.
          if (!detail || detail.version < minimumVersion || (listed?.version === detail.version && listed.latestMessageId !== detail.latestMessageId)) deps.detailFailed(before.selected);
          else deps.applyDetail(detail);
        }
      } catch { if (current()) deps.failed(); }
      finally { running = false; }
    },
    dispose() { disposed = true; },
  };
}
