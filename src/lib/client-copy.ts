import { CLIENT_BRAND_RULES, DEVELOPMENT_BRAND_RULES, containsPrivateBrand, normalizeClientCopy } from "./client-brand-registry.mjs";

/** Use only for Covora-managed metadata. Correspondence and identities stay exact. */
function clientLabel(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!containsPrivateBrand(value, true)) return value;
  let label = normalizeClientCopy(value);
  // Remove an entire private service URL so paths, query strings and fragments
  // cannot survive after merely replacing its hostname.
  label = label.replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, (url: string) => containsPrivateBrand(url, true) ? "" : url);
  label = label.replace(/\S+/g, (token: string) => /\.[a-z]{2,}(?:[/?#]|$)/i.test(token) && containsPrivateBrand(token, true) ? "" : token);
  for (const { pattern, replacement } of [...CLIENT_BRAND_RULES, ...DEVELOPMENT_BRAND_RULES]) {
    label = label.replace(new RegExp(pattern.source, "gi"), replacement);
  }
  label = label.replace(/\s+/g, " ").replace(/^[\s|:;,/–—-]+|[\s|:;,/–—-]+$/g, "").trim();
  return !label || containsPrivateBrand(label, true) ? fallback : label;
}

export const clientCampaignName = (value: string | null | undefined) => clientLabel(value, "Untitled campaign");
export const clientListName = (value: string | null | undefined) => clientLabel(value, "Untitled list");

/** Lifecycle copy preserves the actual state without inventing a connection. */
export function clientOperationalNote(value: string, fallback: string): string {
  return containsPrivateBrand(value, true) ? fallback : value;
}

const REPLY_REASONS = new Set([
  "Replies are disabled in preview.",
  "Your workspace role has read-only access.",
  "Replies are unavailable for this conversation.",
  "Replies are not enabled for this account.",
  "A current conversation is required before replying.",
  "A reply is being checked or its outcome needs review.",
  "A reply is waiting to send.",
  "Sending is currently disabled.",
]);
export function clientReplyReason(value: string | null): string | null {
  return value === null ? null : REPLY_REASONS.has(value) ? value : "Replies are not available for this conversation yet. Contact your Covora account manager for help.";
}
