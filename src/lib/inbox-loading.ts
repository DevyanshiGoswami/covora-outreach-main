import { EMPTY_DATA, type ResultsData } from "./model";
import type { ConversationPage } from "./conversations";
import { conversationError } from "./conversations-transport";
export async function loadInboxData(loadMirror: () => Promise<ResultsData>, loadUnified: () => Promise<ConversationPage>) {
  let error: unknown;
  try { return { data: { ...EMPTY_DATA }, conversations: await loadUnified(), conversationError: undefined }; }
  catch (cause) { error = cause; }
  try { return { data: await loadMirror(), conversations: null, conversationError: conversationError(error) }; }
  catch { throw new Error("Inbox history could not be loaded. Please try again."); }
}
