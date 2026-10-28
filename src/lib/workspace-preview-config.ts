import "server-only";

type SampleProspect = {
  name: string; company: string; role: string; channel: "email" | "linkedin";
  sender: number; subject: string; reply: string; interest: string;
};
type PreviewConfiguration = {
  namespace: "8" | "9";
  senders: readonly { name: string; email: string }[];
  linkedin: { name: string; firstName: string; profileUrl: string };
  campaigns: readonly string[];
  prospects: readonly SampleProspect[];
  introduction: (company: string) => string;
  invitation: string;
  sequence: { subject: string; body: string };
};

const configurations = new Map<string, PreviewConfiguration>([
  ["a2bb9be7-018a-4750-97a0-28e48bbb18b9", {
    namespace: "8",
    senders: [{ name: "Josh", email: "Josh@iceshaker.com" }, { name: "Daniela", email: "Daniela@iceshaker.com" }, { name: "Moose", email: "Moose@iceshaker.com" }],
    linkedin: { name: "Chris Gronkowski", firstName: "Chris", profileUrl: "https://www.linkedin.com/in/chrisgronkowski/" },
    campaigns: ["Corporate gifting & team orders", "Fitness & wellness partnerships", "Retail & distribution"],
    prospects: [
      { name: "Avery Bennett", company: "Northstar Events", role: "Events Director", channel: "email", sender: 0, subject: "Custom bottles for our leadership retreat", reply: "This is great timing. We’re organizing a leadership retreat for 250 people and would love to see the custom branding options. Could you share pricing and the lead time?", interest: "Interested" },
      { name: "Jordan Chen", company: "Summit Wellness", role: "Founder", channel: "email", sender: 1, subject: "A partnership for Summit Wellness", reply: "Thanks for reaching out, Daniela. We’ve been looking for a quality shaker for our members. Happy to schedule a quick call this week to talk about a partnership.", interest: "Meeting booked" },
      { name: "Morgan Reed", company: "Fieldwork Studios", role: "Head of People", channel: "email", sender: 2, subject: "Ice Shaker for the Fieldwork team", reply: "We’re interested in ordering 500 for our team welcome kits. Can you send over a few examples with company logos? Our budget is already approved.", interest: "Interested" },
      { name: "Taylor Brooks", company: "Evergreen Fitness", role: "Owner", channel: "linkedin", sender: 0, subject: "A fit for our fitness community", reply: "Chris, thanks for connecting. Our coaches already know Ice Shaker. Let’s explore a co-branded launch for our new locations. Are you available Thursday?", interest: "Interested" },
      { name: "Cameron Ellis", company: "Canvas Retail", role: "Merchandising Director", channel: "email", sender: 0, subject: "Retail opportunity for Ice Shaker", reply: "The product looks like a good addition to our active lifestyle section. Could you share your wholesale catalog and minimum order quantities?", interest: "Interested" },
      { name: "Riley Stone", company: "Atlas Hospitality", role: "VP of Partnerships", channel: "linkedin", sender: 0, subject: "Guest experience collaboration", reply: "This could work really well for our guest experience program. I’ve looped in our partnerships team and we’d be happy to meet next week.", interest: "Meeting booked" },
      { name: "Casey Parker", company: "Brightwater Group", role: "Marketing Director", channel: "email", sender: 1, subject: "Our next client appreciation campaign", reply: "We’re planning a client appreciation shipment next month. Please send information for 300 custom-branded bottles, including packaging options.", interest: "Interested" },
      { name: "Alex Hayes", company: "Clearpath Athletics", role: "General Manager", channel: "linkedin", sender: 0, subject: "Ice Shaker team partnership", reply: "Love what you’re building, Chris. We have 12 teams that could use these. Happy to introduce you to the person who runs our equipment program.", interest: "Interested" },
    ],
    introduction: company => `I thought Ice Shaker could be a great fit for ${company}. We create premium insulated bottles and shakers that can be customized for teams, events, and partnerships.`,
    invitation: "Would you be open to exploring a few ideas together?",
    sequence: { subject: "An idea for your next team event", body: "Hi {{first_name}},\n\nWe help teams create memorable gifts with custom-branded Ice Shaker bottles. Would you be open to a quick conversation about an upcoming event or partnership?\n\nThe Ice Shaker team" },
  }],
  ["26a2cffb-47f4-4231-9195-b4f772751c6d", {
    namespace: "9",
    senders: [{ name: "Matt", email: "matt@teamepm.com" }, { name: "Anthony", email: "anthony@teamepm.com" }, { name: "Dean", email: "dean@teamepm.com" }, { name: "Julia", email: "julia@teamepm.com" }],
    linkedin: { name: "Telly Fricke", firstName: "Telly", profileUrl: "https://www.linkedin.com/in/telly-fricke-1b9183ba/" },
    campaigns: ["Medical Device Hiring Leaders", "Regional sales team growth", "Distributor recruiting partnerships"],
    prospects: [
      { name: "Jamie Carter", company: "Summit Device Group", role: "VP of Sales", channel: "email", sender: 0, subject: "Candidates for your associate sales openings", reply: "Thanks, Matt. We have three associate sales openings planned for next quarter. Former athletes with medical device sales training sound relevant. Could you share a few sample candidate profiles and outline your placement process?", interest: "Interested" },
      { name: "Drew Lawson", company: "Northline Surgical", role: "Regional Sales Director", channel: "email", sender: 1, subject: "Building our next regional sales team", reply: "Anthony, this is timely. We’re expanding our Midwest territory and would like to learn more about EPM’s training. I’ve booked a time for us to discuss the roles and what a successful first year looks like.", interest: "Meeting booked" },
      { name: "Emerson Blake", company: "Clearview Medical Devices", role: "Talent Acquisition Director", channel: "email", sender: 2, subject: "A new source of medical sales talent", reply: "Hi Dean, we’re interested in a focused pipeline for our entry-level device sales roles. Please send details on the training curriculum and how you match candidates to a manufacturer’s needs.", interest: "Interested" },
      { name: "Quinn Foster", company: "Bridgepoint Orthopedics", role: "Sales Director", channel: "linkedin", sender: 0, subject: "A conversation about your sales hiring plans", reply: "Telly, thanks for connecting. We have several sales openings coming up and would be open to meeting candidates who understand the demands of a competitive team environment. Could we speak next week?", interest: "Interested" },
      { name: "Parker Wells", company: "Crestline Surgical Partners", role: "Managing Director", channel: "email", sender: 3, subject: "Recruiting support for our distributor team", reply: "Julia, we’re looking to add two associate representatives this quarter. I’d like to understand your candidate availability, placement timeline, and how EPM prepares people for a surgical sales environment.", interest: "Interested" },
      { name: "Reese Morgan", company: "Westhaven Device Solutions", role: "VP of Commercial Operations", channel: "linkedin", sender: 0, subject: "Exploring a device sales recruiting partnership", reply: "This could be a useful partnership, Telly. Our hiring team wants to meet more prepared candidates for our expansion. I’ve reserved time for an introductory call with you and our sales director.", interest: "Meeting booked" },
      { name: "Dakota Lane", company: "Harborview Medical Systems", role: "Head of Recruiting", channel: "email", sender: 0, subject: "Your next medical device sales cohort", reply: "We’re interested in learning more about the next group completing your program. Could you share their preferred regions and explain how introductions work? We have approved headcount for our new territories.", interest: "Interested" },
      { name: "Skyler Hayes", company: "Oakridge Device Distribution", role: "Founder", channel: "linkedin", sender: 0, subject: "Sales talent for our distributor network", reply: "Telly, I like the focus on former athletes transitioning into device sales. We’re hiring across two regions and I’d be happy to introduce you to our recruiting lead for a conversation.", interest: "Interested" },
    ],
    introduction: company => `Elite Performance Medical helps former college and professional athletes prepare for careers in medical device sales. We connect trained candidates with U.S. device manufacturers and distributors, and thought we could support ${company}’s hiring plans.`,
    invitation: "Would you be open to a short conversation about your upcoming sales roles?",
    sequence: { subject: "A new pipeline for your medical device sales team", body: "Hi {{first_name}},\n\nElite Performance Medical prepares former college and professional athletes for medical device sales careers. We connect trained candidates with manufacturers and distributors building their next sales team.\n\nWould you be open to discussing your upcoming hiring needs?\n\nThe Elite Performance Medical team" },
  }],
]);

/** An exact configured client is required; names, email domains, and unknown IDs cannot select a preview. */
export function previewConfiguration(clientId: string) {
  return configurations.get(clientId) ?? null;
}
