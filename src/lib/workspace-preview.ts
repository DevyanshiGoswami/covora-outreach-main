import "server-only";
import { isPreviewWorkspace, type Workspace } from "./access";
import type { Campaign, ResultsData } from "./model";
import type { ConversationDetail, ConversationPage } from "./conversations";
import { previewConfiguration } from "./workspace-preview-config";

const date = "2026-10-05";
export type PreviewConnection = { channel: "email" | "linkedin"; name: string; address: string; profileUrl?: string };
export type WorkspacePreview = { asOf: string; data: ResultsData; conversations: ConversationPage; details: ConversationDetail[]; connections: PreviewConnection[] };

/** This factory is server-only and requires the verified membership AND configured workspace. */
export function workspacePreview(workspace: Workspace): WorkspacePreview | null {
  if (!isPreviewWorkspace(workspace) || !workspace.clientId || !workspace.role) return null;
  const config = previewConfiguration(workspace.clientId);
  if (!config) return null;
  const previewClientId = workspace.clientId;
  const fixtureId = (kind: 1 | 2 | 3 | 4, index: number) => `${config.namespace}${kind}000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const campaignIds = [1, 2, 3].map(index => fixtureId(1, index));
  const { senders, prospects: people, campaigns: names } = config;
  const totals = [
    { leads: 5200, contacted: 4300, sent: 5340, unique_replies: 316, unique_auto_replies: 6, positive_replies: 92, bounced: 21, opportunities: 16, completed: 3100 },
    { leads: 3000, contacted: 2500, sent: 3420, unique_replies: 188, unique_auto_replies: 8, positive_replies: 57, bounced: 13, opportunities: 9, completed: 1720 },
    { leads: 2025, contacted: 1620, sent: 2280, unique_replies: 114, unique_auto_replies: 4, positive_replies: 36, bounced: 8, opportunities: 5, completed: 1100 },
  ];
  const campaigns: Campaign[] = campaignIds.map((id, index) => ({
    id, client_id: previewClientId, name: names[index], status: "active", totals: totals[index], synced_at: null,
    schedule: { start_date: "2026-09-06", windows: [{ timezone: "America/Chicago", from: "09:00", to: "16:00", days: [1, 2, 3, 4, 5] }] },
  }));
  const weights = Array.from({ length: 30 }, (_, index) => {
    const day = new Date("2026-09-06T00:00:00Z"); day.setUTCDate(day.getUTCDate() + index);
    return [0, 6].includes(day.getUTCDay()) ? 0 : 10 + index * .4 + index % 4 * 2;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const share = (total: number, index: number) => Math.round(total * weights.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / weightTotal) - Math.round(total * weights.slice(0, index).reduce((sum, value) => sum + value, 0) / weightTotal);
  const daily = Array.from({ length: 30 }, (_, dayIndex) => {
    const day = new Date("2026-09-06T00:00:00Z"); day.setUTCDate(day.getUTCDate() + dayIndex);
    return campaigns.map((campaign) => ({
      campaign_id: campaign.id, day: day.toISOString().slice(0, 10),
      sent: share(campaign.totals.sent, dayIndex),
      contacted: share(campaign.totals.contacted, dayIndex),
      new_contacted: share(campaign.totals.contacted, dayIndex),
      unique_replies: share(campaign.totals.unique_replies, dayIndex),
      auto_replies: share(campaign.totals.unique_auto_replies, dayIndex), opportunities: share(campaign.totals.opportunities, dayIndex),
    }));
  }).flat();
  const details: ConversationDetail[] = people.map((person, index) => {
    const id = fixtureId(2, index + 1);
    const sentId = fixtureId(3, index * 2 + 1);
    const replyId = fixtureId(3, index * 2 + 2);
    const email = `${person.name.toLowerCase().replace(" ", ".")}@example.com`;
    const sender = person.channel === "email" ? senders[person.sender].email : config.linkedin.name;
    const timestamp = `2026-10-05T${String(19 - index).padStart(2, "0")}:20:00Z`;
    return {
      id, clientId: previewClientId, channel: person.channel, campaignId: campaignIds[index % campaignIds.length], campaignName: names[index % names.length],
      subject: person.subject, contactName: person.name, contactAddress: person.channel === "email" ? email : `${person.name} · ${person.company}`, senderLabel: sender,
      owner: { kind: "covora", userId: null, name: "Covora" }, ownedByMe: false, version: 1,
      latestMessageId: replyId, latestAt: timestamp, preview: person.reply, unread: index < 5, status: "needs_reply", interest: person.interest,
      canReply: true, canTakeover: true, replyUnavailableReason: null,
      messages: [
        { id: sentId, direction: "sent", bodyText: `Hi ${person.name.split(" ")[0]},\n\n${config.introduction(person.company)}\n\n${config.invitation}\n\n${person.channel === "email" ? senders[person.sender].name : config.linkedin.firstName}`, sentAt: "2026-10-03T15:00:00Z", senderLabel: sender },
        { id: replyId, direction: "received", bodyText: person.reply, sentAt: timestamp, senderLabel: person.channel === "email" ? email : person.name },
      ], commands: [], messagesTruncated: false,
    };
  });
  const data: ResultsData = {
    campaigns, daily, messages: [], unread: details.filter((item) => item.unread).length, truncated: false,
    leads: people.map((person, index) => ({ id: fixtureId(4, index + 1), campaign_id: campaignIds[index % 3], email: `${person.name.toLowerCase().replace(" ", ".")}@example.com`, first_name: person.name.split(" ")[0], last_name: person.name.split(" ").slice(1).join(" "), company: person.company, status: "replied", last_step: 1, reply_count: 1, interest: 1, last_activity_at: details[index].latestAt })),
    steps: campaigns.flatMap((campaign) => [{ campaign_id: campaign.id, step: 1, variant: 0, subject: config.sequence.subject, body_text: config.sequence.body, delay_days: 3, stats: {} }]),
    linkedin: [],
    networkCampaigns: [],
  };
  return { asOf: date, data, conversations: { conversations: details, nextCursor: null }, details, connections: [
    ...senders.map((sender): PreviewConnection => ({ channel: "email", name: sender.name, address: sender.email })),
    { channel: "linkedin", name: config.linkedin.name, address: config.linkedin.name, profileUrl: config.linkedin.profileUrl },
  ] };
}
