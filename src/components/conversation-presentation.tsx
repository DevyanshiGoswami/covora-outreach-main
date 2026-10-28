import { ArrowDownLeft, ArrowUpRight, ChevronDown, Mail, Network, UserRound } from "lucide-react";

type Channel = "email" | "linkedin";

/** Contact marks are local and decorative; no address is sent to an avatar service. */
export function ContactAvatar({ name = "", address = "", channel, size = "medium", team = false }: {
  name?: string; address?: string; channel?: Channel; size?: "small" | "medium" | "large"; team?: boolean;
}) {
  const identity = (address || name).trim().toLowerCase();
  const words = (name || address).split("@")[0].trim().split(/[\s._-]+/u).filter(Boolean);
  const letters = words.slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase();
  const tone = Array.from(identity).reduce((sum, letter) => (sum * 31 + letter.codePointAt(0)!) % 5, 0);
  return <span className="contact-avatar" data-tone={team ? "team" : tone} data-size={size} aria-hidden="true">
    <span className="contact-monogram">{team ? <ArrowUpRight size={size === "large" ? 25 : 19} /> : letters || <UserRound size={18} />}</span>
    {channel && <span className="contact-channel-mark">{channel === "email" ? <Mail size={11} /> : <Network size={11} />}</span>}
  </span>;
}

export function ConversationChannel({ channel }: { channel: Channel }) {
  return <span className="conversation-channel-label">{channel === "email" ? <Mail size={13} aria-hidden="true" /> : <Network size={13} aria-hidden="true" />}{channel === "email" ? "Email" : "LinkedIn"}</span>;
}

const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/** Compact thread entry; the body stays plain text and the exact time stays available on hover. */
export function ConversationTimelineEntry({ sender, senderName, direction, channel, sentAt, body }: {
  sender: string; senderName?: string; direction: "sent" | "received"; channel: Channel; sentAt: string; body: string;
}) {
  const validDate = Number.isFinite(Date.parse(sentAt));
  const displayName = senderName || sender || (direction === "sent" ? "Your team" : "Contact");
  return <li className="timeline-entry" data-direction={direction}>
    <ContactAvatar name={displayName} address={sender} size="small" team={direction === "sent"} />
    <div className="timeline-entry-content">
      <div className="timeline-entry-header">
        <span><strong>{displayName}</strong> · {channel === "email" ? "Email" : "LinkedIn"}{senderName && sender !== senderName ? ` · ${sender}` : ""}</span>
        <span><time dateTime={validDate ? sentAt : undefined} title={validDate ? `${date.format(new Date(sentAt))} UTC` : undefined}>{validDate ? short.format(new Date(sentAt)) : "Time unavailable"}</time> · <span className="timeline-direction">{direction === "sent" ? "Sent" : "Received"}</span></span>
      </div>
      <div className="message-plain-text">{body || "No plain-text content available for this message."}</div>
    </div>
  </li>;
}

/** A message's historical addressing is displayed only when supplied by its source. */
export function ConversationMessageCard({ sender, senderName, recipient, direction, channel = "email", sentAt, body, automatic = false }: {
  sender: string; senderName?: string; recipient?: string; direction: "sent" | "received" | "unknown"; channel?: Channel; sentAt: string; body: string; automatic?: boolean;
}) {
  const validDate = Number.isFinite(Date.parse(sentAt));
  const fullDate = validDate ? `${date.format(new Date(sentAt))} UTC` : "Time unavailable";
  const displayName = senderName || sender || (direction === "sent" ? "Your team" : "Contact");
  return <article className="message-entry" data-direction={direction}>
    <div className="message-entry-header">
      <div className="message-sender">
        <ContactAvatar name={displayName} address={sender} size="small" team={direction === "sent"} />
        <div>
          <h3>{displayName}</h3>
          {sender && sender !== displayName && <p className="message-addresses">{sender}</p>}
          <span className="message-direction">{direction === "sent" ? <ArrowUpRight size={12} aria-hidden="true" /> : direction === "received" ? <ArrowDownLeft size={12} aria-hidden="true" /> : null}{direction === "sent" ? "Sent" : direction === "received" ? "Received" : "Message"} · {channel === "email" ? "Email" : "LinkedIn"}</span>
        </div>
      </div>
      <time dateTime={validDate ? sentAt : undefined} title={fullDate}>{validDate ? short.format(new Date(sentAt)) : "Time unavailable"}{validDate && <span>UTC</span>}</time>
    </div>
    {automatic && <p className="message-auto-reply">Automatic reply</p>}
    <div className="message-plain-text">{body || "No plain-text content available for this message."}</div>
    <details className="message-details">
      <summary>Message details<ChevronDown size={13} aria-hidden="true" /></summary>
      <dl><div><dt>Sender</dt><dd>{sender || "Unavailable"}</dd></div>{recipient !== undefined && <div><dt>To</dt><dd>{recipient || "Unavailable"}</dd></div>}<div><dt>Date</dt><dd>{fullDate}</dd></div></dl>
    </details>
  </article>;
}
