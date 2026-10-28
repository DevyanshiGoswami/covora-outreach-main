import { positiveOutcome, type ConversationMessage } from "./conversations";

/** Extractive, on-device summary. Nothing is sent anywhere; output only quotes or describes existing message text. */
export type ConversationSummaryResult = { headline: string; quotes: string[]; quoteLabel: "They asked" | "They wrote"; nextStep: string | null };
export type ReplyTag = { label: string; tone: "positive" | "question" | "neutral" };

type Intent = "declined" | "away" | "pricing" | "meeting" | "referral" | "details" | "question";
const INTENT_PATTERNS: [Intent, RegExp][] = [
  ["declined", /\b(not interested|no thanks|no, thank|unsubscribe|remove me|stop (emailing|contacting|messaging)|not a fit|not the right time|pass on this)\b/i],
  ["away", /\b(out of (the )?office|ooo|on (annual |parental |maternity )?leave|on vacation|on holiday|away until|limited access to email)\b/i],
  ["pricing", /\b(pric(e|es|ing)|cost(s)?|rates?|quote|budget|how much|fees?)\b/i],
  ["meeting", /\b(call|meeting|meet|chat|calendar|schedule|book (a|some) time|availab(le|ility)|monday|tuesday|wednesday|thursday|friday|next week|this week)\b/i],
  ["referral", /\b(forward(ed)?|colleague|my manager|the right person|reach out to|cc'?d|loop(ed)? in)\b/i],
  ["details", /\b(tell me more|more (info|information|details)|learn more|hear more|share (a little |some )?more|send (me |over )?(some |the )?(details|info|deck|examples?|case stud(y|ies))|what does .* look like|how does .* work|how .* works)\b/i],
];
const NEXT_STEPS: Record<Intent, string> = {
  declined: "no reply is needed unless you want to close politely.",
  away: "follow up after they return.",
  pricing: "send pricing and offer a short call.",
  meeting: "propose or confirm a time to talk.",
  referral: "follow up with the person they pointed you to.",
  details: "send the details they asked for.",
  question: "answer their question.",
};
const PHRASES: Record<Intent, string> = {
  declined: "is not interested",
  away: "sent an away reply",
  pricing: "asked for pricing",
  meeting: "wants to set up a call",
  referral: "pointed you to someone else",
  details: "wants to hear more",
  question: "asked a question",
};
const TAGS: Record<Intent, string> = {
  declined: "declined", away: "away", pricing: "asked for pricing", meeting: "wants a call",
  referral: "referred you", details: "asked for more info", question: "asked a question",
};
const MAX_QUOTE = 180;

/** Drops quoted history and sign-offs so only the newly written part of a message is summarized. */
export function newMessageText(body: string): string {
  const lines: string[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (/^(on .+ wrote:|-{2,}\s*original message|from: .+@|sent from my )/i.test(line) || line === "--") break;
    if (line.startsWith(">")) continue;
    lines.push(line);
  }
  const text = lines.join("\n").replace(/\n(best|thanks|thank you|regards|kind regards|cheers|sincerely)[,!.]?\s*\n[\s\S]*$/i, "");
  return text.replace(/\s+/g, " ").trim();
}

export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) || []).map(item => item.trim()).filter(item => /[\p{L}\p{N}]/u.test(item));
}

const clip = (value: string) => Array.from(value).length > MAX_QUOTE ? `${Array.from(value).slice(0, MAX_QUOTE - 1).join("").trimEnd()}…` : value;
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const day = (value: string) => Number.isFinite(Date.parse(value)) ? shortDay.format(new Date(value)) : "an unknown date";
const list = (items: string[]) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function intentsOf(text: string): Intent[] {
  const found = INTENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([intent]) => intent);
  if (/\?/.test(text)) found.push("question");
  return found;
}

export function summarizeConversation(messages: ConversationMessage[], contactName: string): ConversationSummaryResult {
  const ordered = messages.toSorted((a, b) => a.sentAt.localeCompare(b.sentAt));
  const received = ordered.filter(item => item.direction === "received");
  const latest = received.at(-1);
  const name = contactName.trim().split(/\s+/)[0] || "The contact";
  if (!ordered.length) return { headline: "There are no messages in this conversation yet.", quotes: [], quoteLabel: "They wrote", nextStep: null };
  if (!latest) return { headline: `Your team has sent ${ordered.length} ${ordered.length === 1 ? "message" : "messages"} and ${name} has not replied yet.`, quotes: [], quoteLabel: "They wrote", nextStep: "wait for their reply." };

  const text = newMessageText(latest.bodyText);
  const parts = sentences(text);
  const intents = intentsOf(text);
  const asks = parts.filter(item => item.endsWith("?"));
  const signals = parts.filter(item => !item.endsWith("?") && INTENT_PATTERNS.some(([, pattern]) => pattern.test(item)));
  const quotes = (asks.length ? asks : signals.length ? signals : parts).slice(0, 2).map(clip);
  // "asked a question" adds nothing once a more specific request is named.
  const described = intents.filter(intent => intent !== "question" || intents.length === 1).slice(0, 2).map(intent => PHRASES[intent]);
  const repliedLast = ordered.at(-1)!.direction === "sent";
  const when = received.length === 1 ? `replied on ${day(latest.sentAt)}` : `has replied ${received.length} times, most recently on ${day(latest.sentAt)}`;
  const headline = `${name} ${when}${described.length ? ` and ${list(described)}` : ""}.${repliedLast ? " Your team has replied since." : ""}`;
  const nextStep = repliedLast && !intents.includes("declined") ? "wait for their reply." : intents.length ? NEXT_STEPS[intents[0]] : null;
  return { headline, quotes, quoteLabel: asks.length ? "They asked" : "They wrote", nextStep };
}

/** Short row/heading tag. Reasons are read only from a prospect-written latest message. */
export function replyTag(interest: string | null | undefined, latestFromProspect: string | null): ReplyTag | null {
  const intents = latestFromProspect ? intentsOf(newMessageText(latestFromProspect)) : [];
  const reason = intents.length ? TAGS[intents[0]] : null;
  if (interest) return { label: reason ? `${interest}: ${reason}` : interest, tone: positiveOutcome(interest) ? "positive" : "neutral" };
  if (!reason) return null;
  return { label: capital(reason), tone: intents[0] === "declined" || intents[0] === "away" ? "neutral" : intents[0] === "question" ? "question" : "positive" };
}
