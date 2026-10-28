import type { ConversationMessage } from "./conversations";
import { intentsOf, newMessageText } from "./conversation-summary";

/**
 * On-device reply draft built from the whole thread. It is only ever placed in the composer:
 * a person must review it and press Send. Facts only a person knows are left as placeholders.
 */
export const DRAFT_PLACEHOLDERS = ["[pricing details]", "[booking link]", "[two times that suit you]", "[one or two lines on what you offer]", "[answer their question]", "[their colleague's name]", "[your reply]"] as const;

export function unfilledPlaceholders(text: string): string[] {
  return DRAFT_PLACEHOLDERS.filter(item => text.includes(item));
}

const TITLES = /^(dr|mr|mrs|ms|mx|prof)\.?$/i;
function greet(contactName: string): string {
  const name = contactName.trim().split(/\s+/).find(word => !TITLES.test(word));
  return name && !name.includes("@") && /\p{L}/u.test(name) ? `Hi ${name},` : "Hi,";
}

/**
 * Follow-up for a thread where the team spoke last. The tone eases off with each unanswered
 * follow-up and closes the loop at the third, so prospects are not chased indefinitely.
 */
export function suggestFollowUp(messages: ConversationMessage[], contactName: string): { text: string; number: number } | null {
  const ordered = messages.toSorted((a, b) => a.sentAt.localeCompare(b.sentAt));
  if (!ordered.length || ordered.at(-1)!.direction !== "sent") return null;
  const lastReceived = ordered.findLastIndex(item => item.direction === "received");
  // Messages sent since their last reply (or since the first outreach); the next follow-up is this number.
  const number = ordered.length - 1 - lastReceived;
  const greeting = greet(contactName);
  const body = lastReceived !== -1 && number === 1
    ? "Just checking in on my last message. Did you get a chance to look at it?\n\nBest,"
    : number <= 1 ? "I wanted to follow up on my last note in case it got buried. Would it be worth a quick conversation?\n\nBest,"
      : number === 2 ? "Circling back once more in case the timing is better now. Happy to send a couple of examples if that would help, or just let me know if it's not a fit.\n\nBest,"
        : "I don't want to keep filling your inbox, so this will be my last note for now. If it becomes relevant later, just reply here and I'll pick it up.\n\nAll the best,";
  return { text: `${greeting}\n\n${body}`, number };
}

export function suggestReply(messages: ConversationMessage[], contactName: string): string | null {
  const ordered = messages.toSorted((a, b) => a.sentAt.localeCompare(b.sentAt));
  const latest = ordered.at(-1);
  if (!latest || latest.direction !== "received") return null;
  const intents = intentsOf(newMessageText(latest.bodyText));
  if (intents[0] === "away") return null;
  const greeting = greet(contactName);
  const earlier = ordered.filter(item => item.direction === "received").length > 1 ? "Thanks again for the replies." : "Thanks for getting back to me.";
  const body = (() => {
    switch (intents[0]) {
      case "declined": return "Thanks for letting me know, I appreciate the reply. I won't follow up further.\n\nAll the best,";
      case "pricing": return `${earlier} Here is how pricing works for this: [pricing details]\n\nIt depends a little on scope, so I'm happy to walk you through the options on a short call. You can pick a time here: [booking link]\n\nBest,`;
      case "meeting": return `${earlier} Happy to set up a call. [two times that suit you] work on my side, or you can pick a time here: [booking link]\n\nLooking forward to it,`;
      case "details": return `${earlier} Here is a quick overview: [one or two lines on what you offer]\n\nIf it's easier, I can walk you through it on a short call: [booking link]\n\nBest,`;
      case "referral": return "Thanks for pointing me in the right direction. I'll reach out to [their colleague's name] directly.\n\nBest,";
      case "question": return `Good question. [answer their question]\n\nHappy to go into more detail on a short call if that helps.\n\nBest,`;
      default: return `${earlier} [your reply]\n\nBest,`;
    }
  })();
  return `${greeting}\n\n${body}`;
}
