import type { ResultsData, Campaign, Lead, Message } from "./model";

export const DEMO_DATE = "2026-10-02";
export const DEMO_CLIENT = "00000000-0000-4000-8000-000000000001";
const ids = [1, 2, 3].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const campaigns: Campaign[] = [
  {
    id: ids[0],
    client_id: DEMO_CLIENT,
    name: "Founder introductions",
    status: "active",
    totals: {
      leads: 1800,
      contacted: 1260,
      sent: 3240,
      unique_replies: 106,
      unique_auto_replies: 18,
      positive_replies: 32,
      bounced: 12,
      opportunities: 24,
      completed: 720,
    },
    synced_at: "2026-10-02T17:42:00Z",
    schedule: {
      windows: [
        {
          timezone: "America/Los_Angeles",
          from: "09:00",
          to: "17:00",
          days: [1, 2, 3, 4, 5],
        },
      ],
    },
  },
  {
    id: ids[1],
    client_id: DEMO_CLIENT,
    name: "SaaS growth leaders",
    status: "active",
    totals: {
      leads: 1200,
      contacted: 780,
      sent: 1870,
      unique_replies: 61,
      unique_auto_replies: 8,
      positive_replies: 19,
      bounced: 8,
      opportunities: 13,
      completed: 410,
    },
    synced_at: "2026-10-02T17:40:00Z",
    schedule: {
      windows: [
        {
          timezone: "America/New_York",
          from: "09:00",
          to: "16:00",
          days: [1, 2, 3, 4],
        },
      ],
    },
  },
  {
    id: ids[2],
    client_id: DEMO_CLIENT,
    name: "September partnerships",
    status: "completed",
    totals: {
      leads: 650,
      contacted: 650,
      sent: 1540,
      unique_replies: 48,
      unique_auto_replies: 5,
      positive_replies: 17,
      bounced: 5,
      opportunities: 10,
      completed: 650,
    },
    synced_at: "2026-10-01T17:30:00Z",
    schedule: {
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      windows: [
        {
          timezone: "America/Los_Angeles",
          from: "10:00",
          to: "16:00",
          days: [1, 2, 3, 4, 5],
        },
      ],
    },
  },
];
const people = [
  ["Alex", "Morgan", "Northstar Studio", "alex@example.com", 2],
  ["Jordan", "Lee", "Evergreen Labs", "jordan@example.com", 1],
  ["Taylor", "Reed", "Summit Works", "taylor@example.com", 1],
  ["Sam", "Chen", "Canvas Group", "sam@example.com", 0],
  ["Casey", "Rivera", "Harbor Systems", "casey@example.com", -1],
  ["Avery", "Brooks", "Fieldwork", "avery@example.com", null],
] as const;
const leads: Lead[] = people.map((p, i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  campaign_id: ids[i % 3],
  first_name: p[0],
  last_name: p[1],
  company: p[2],
  email: p[3],
  interest: p[4],
  status: i < 5 ? "replied" : "in_sequence",
  last_step: i < 5 ? 2 : 1,
  reply_count: i < 5 ? 1 : 0,
  last_activity_at: "2026-10-02T16:30:00Z",
}));
const replies = [
  "Hi there,\n\nThis looks relevant to what we’re building. I’d be happy to chat next week. Tuesday or Thursday afternoon would work well.\n\nBest,\nAlex",
  "Thanks for reaching out! We’ve been thinking about a more consistent presence on LinkedIn. Could you share what the first month looks like?\n\nJordan",
  "Hi,\n\nThe timing is good. Please send a little more information about the approach and a couple of examples.\n\nTaylor",
  "I’m away from my desk until October 6 and will respond when I return.\n\nSam",
  "Thanks for thinking of us. We’re all set for now, but wishing you the best.\n\nCasey",
];
const messages: Message[] = leads.slice(0, 5).flatMap((lead, i) => {
  const base = {
    campaign_id: lead.campaign_id,
    thread_key: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    lead_email: lead.email,
    subject: `An idea for ${lead.company}`,
    interest: lead.interest,
    is_auto_reply: false,
  };
  return [
    {
      ...base,
      id: `40000000-0000-4000-8000-${String(i * 2 + 1).padStart(12, "0")}`,
      direction: "sent",
      from_email: "hello@example.com",
      to_email: lead.email,
      body_text: `Hi ${lead.first_name},\n\nI came across ${lead.company} and thought your team’s perspective would make for interesting conversations on LinkedIn.\n\nWe help founders turn their experience into a consistent presence. Would it be useful to see a few ideas?\n\nThe Covora team`,
      sent_at: `2026-09-${27 - i}T16:30:00Z`,
      client_read_at: "2026-09-30T18:00:00Z",
    },
    {
      ...base,
      id: `40000000-0000-4000-8000-${String(i * 2 + 2).padStart(12, "0")}`,
      direction: "received",
      from_email: lead.email,
      to_email: "hello@example.com",
      body_text: replies[i],
      sent_at: `2026-10-02T${17 - i}:30:00Z`,
      client_read_at: i < 2 ? null : "2026-10-02T18:00:00Z",
      is_auto_reply: i === 3,
    },
  ];
});
export function demoData(): ResultsData {
  return {
    campaigns,
    networkCampaigns: [],
    leads,
    messages,
    unread: 2,
    truncated: false,
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date("2026-09-03T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + i);
      return ids.map((id, c) => ({
        campaign_id: id,
        day: date.toISOString().slice(0, 10),
        sent:
          date.getUTCDay() % 6 === 0 || (c === 2 && i > 27)
            ? 0
            : 45 + ((i * 13 + c * 17) % 85),
        contacted: 30 + (i % 20),
        new_contacted: 15 + (i % 10),
        unique_replies: date.getUTCDay() % 6 === 0 ? 0 : 1 + ((i + c) % 5),
        auto_replies: i % 2,
        opportunities: i % 3 === 0 ? 1 : 0,
      }));
    }).flat(),
    steps: ids.flatMap((id) => [
      {
        campaign_id: id,
        step: 1,
        variant: 0,
        subject: "An idea for your team",
        body_text:
          "Hi {{first_name}},\n\nYour team’s perspective caught my attention. We help founders share what they know and build meaningful conversations on LinkedIn.\n\nWould it be useful if I sent over a few ideas?\n\nThe Covora team",
        delay_days: 3,
        stats: {},
      },
      {
        campaign_id: id,
        step: 2,
        variant: 0,
        subject: "Re: An idea for your team",
        body_text:
          "Hi {{first_name}},\n\nA quick follow-up to my note. Your experience is often the most useful thing you can share with the people you want to reach.\n\nHappy to send a couple of examples if that would help.\n\nThe Covora team",
        delay_days: 5,
        stats: {},
      },
      {
        campaign_id: id,
        step: 3,
        variant: 0,
        subject: "One last thought",
        body_text:
          "Hi {{first_name}},\n\nI’ll leave this here for now. If building a consistent voice on LinkedIn becomes a priority, we’d love to help.\n\nAll the best,\nThe Covora team",
        delay_days: 0,
        stats: {},
      },
    ]),
    linkedin: Array.from({ length: 14 }, (_, i) => ({
      client_id: DEMO_CLIENT,
      day: `2026-09-${String(17 + i).padStart(2, "0")}`,
      source: "dm_log",
      sent: 15,
      replied: i % 4,
      meeting_booked: i % 5 === 0 ? 1 : 0,
    })),
  };
}
