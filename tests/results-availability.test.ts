import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignTable } from "../src/components/controls";
import {
  analyticsAvailability,
  campaignMetric,
  campaignResultsLabel,
  reportedCampaignReplyRate,
  reportedCampaignTotals,
  reportedRate,
  resultsAvailabilityNote,
} from "../src/lib/results-availability";
import { parseSelection, type Campaign } from "../src/lib/model";

const draft = (totals: Campaign["totals"] = {}, analyticsAvailable: boolean | undefined = false): Campaign => ({
  id: "campaign-a", client_id: "client-a", name: "Draft campaign", status: "draft",
  schedule: {}, synced_at: null, totals, analyticsAvailable,
});

test("preserves explicit analytics availability without coercing missing flags", () => {
  assert.equal(analyticsAvailability({ analytics_available: false, positive_replies: 2 }), false);
  assert.equal(analyticsAvailability({ analytics_available: true }), true);
  for (const value of [null, [], {}, { analytics_available: 0 }, { analytics_available: "false" }])
    assert.equal(analyticsAvailability(value), undefined);
});

test("drafts without analytics retain measured positive replies while other metrics stay unavailable", () => {
  const campaign = draft({ positive_replies: 2 });
  assert.equal(campaignMetric(campaign, "contacted"), null);
  assert.equal(campaignMetric(campaign, "replies"), null);
  assert.equal(campaignMetric(campaign, "opportunities"), null);
  assert.equal(campaignMetric(campaign, "positive_replies"), 2);
  assert.equal(reportedRate(null, null), null);
  assert.equal(campaignResultsLabel(campaign), "Results pending");
  assert.deepEqual(reportedCampaignTotals([campaign]), { contacted: null, replies: null, positive_replies: 2, opportunities: null });
  assert.equal(resultsAvailabilityNote([campaign]), "1 draft has no reported results yet.");
});

test("previous results including actual zeroes survive unavailable analytics and are labeled last reported", () => {
  const campaign = draft({ contacted: 100, unique_replies: 15, unique_auto_replies: 5, positive_replies: 0, opportunities: 0 });
  assert.equal(campaignMetric(campaign, "replies"), 10);
  assert.equal(campaignMetric(campaign, "opportunities"), 0);
  assert.equal(reportedRate(10, 100), 0.1);
  assert.equal(reportedRate(0, 100), 0);
  assert.equal(campaignResultsLabel(campaign), "Last reported");
  assert.equal(resultsAvailabilityNote([campaign]), "1 draft shows last reported results.");
});

test("aggregate results retain reported totals and describe drafts omitted from unknown metrics", () => {
  const pending = draft({ positive_replies: 1 });
  const active = { ...draft({ contacted: 100, unique_replies: 15, unique_auto_replies: 5, positive_replies: 3, opportunities: 2 }, true), status: "active" };
  assert.deepEqual(reportedCampaignTotals([active, pending]), { contacted: 100, replies: 10, positive_replies: 4, opportunities: 2 });
  assert.equal(resultsAvailabilityNote([active, pending, pending]), "2 drafts have no reported results yet.");
  assert.equal(resultsAvailabilityNote([active]), null);
});

test("partial and nonfinite measurements cannot manufacture a human reply count or rate", () => {
  assert.equal(campaignMetric(draft({ unique_replies: 3 }), "replies"), null);
  assert.equal(campaignMetric(draft({ unique_auto_replies: 1 }), "replies"), null);
  assert.equal(campaignMetric(draft({ contacted: Infinity }), "contacted"), null);
  assert.equal(reportedRate(3, null), null);
  assert.equal(reportedRate(null, 100), null);
});

test("aggregate reply rates require contacted and reply counts from the same campaigns", () => {
  const reported = draft({ contacted: 100, unique_replies: 10, unique_auto_replies: 0 }, true);
  assert.equal(reportedCampaignReplyRate([reported, draft({ contacted: 900 })]), null);
  assert.equal(reportedCampaignReplyRate([reported, draft({ unique_replies: 100, unique_auto_replies: 0 })]), null);
  assert.equal(reportedCampaignReplyRate([reported, draft()]), 0.1);
  assert.equal(reportedCampaignReplyRate([draft()]), null);
});

test("legacy and available campaigns preserve established zero and preview semantics", () => {
  for (const campaign of [{ ...draft(), analyticsAvailable: undefined }, draft({}, true)]) {
    assert.equal(campaignMetric(campaign, "contacted"), 0);
    assert.equal(campaignMetric(campaign, "replies"), 0);
    assert.equal(campaignResultsLabel(campaign), null);
    assert.equal(resultsAvailabilityNote([campaign]), null);
    assert.deepEqual(reportedCampaignTotals([campaign]), { contacted: 0, replies: 0, positive_replies: 0, opportunities: 0 });
  }
});

test("campaign table renders missing results as dashes and keeps measured zeroes and previous results", () => {
  const render = (campaign: Campaign) => renderToStaticMarkup(createElement(CampaignTable, {
    campaigns: [campaign], selection: parseSelection({ client: campaign.client_id }), demo: false,
  }));
  const pending = render(draft({ positive_replies: 0 }));
  assert.match(pending, /Results pending/);
  assert.equal((pending.match(/—/g) || []).length, 5);
  assert.doesNotMatch(pending, /0%|class="progress"/);
  const previous = render(draft({ leads: 100, contacted: 10, unique_replies: 3, unique_auto_replies: 1, opportunities: 0 }));
  assert.match(previous, /Last reported/);
  assert.match(previous, /<td>10<\/td><td>2<\/td><td>20%<\/td><td>0<\/td>/);
  assert.doesNotMatch(previous, /—/);
  const zero = render(draft({ leads: 100, contacted: 0, unique_replies: 0, unique_auto_replies: 0, opportunities: 0 }, true));
  assert.match(zero, /Email campaign/);
  assert.match(zero, /0%/);
  assert.doesNotMatch(zero, /Results pending|Last reported|—/);
});


test("two measured active campaigns and three pending campaigns retain partial totals with an explicit note", () => {
  const active = (totals: Campaign["totals"], available = false): Campaign => ({ ...draft(totals, available), status: "active" });
  const measured = active({ contacted: 100, unique_replies: 15, unique_auto_replies: 5, positive_replies: 3, opportunities: 2 }, true);
  const pending = [1, 2, 3].map(positive_replies => active({ positive_replies }));
  const campaigns = [measured, measured, ...pending];
  assert.deepEqual(reportedCampaignTotals(campaigns), { contacted: 200, replies: 20, positive_replies: 12, opportunities: 4 });
  assert.equal(reportedCampaignReplyRate(campaigns), 0.1);
  assert.equal(resultsAvailabilityNote(campaigns), "Results are pending for 3 active campaigns. Totals include available measurements only.");
  assert.deepEqual(reportedCampaignTotals(pending), { contacted: null, replies: null, positive_replies: 6, opportunities: null });
  assert.equal(reportedCampaignReplyRate(pending), null);
  assert.equal(resultsAvailabilityNote([pending[0]]), "Results are pending for 1 active campaign. Totals include available measurements only.");
});

test("active historical results preserve measured zeroes and disclose the older measurement state", () => {
  const historical = { ...draft({ contacted: 50, unique_replies: 6, unique_auto_replies: 2, positive_replies: 0, opportunities: 0 }), status: "active" };
  const pending = { ...draft({ positive_replies: 2 }), status: "active" };
  assert.deepEqual(reportedCampaignTotals([historical, pending]), { contacted: 50, replies: 4, positive_replies: 2, opportunities: 0 });
  assert.equal(reportedCampaignReplyRate([historical, pending]), 0.08);
  assert.equal(campaignResultsLabel(historical), "Last reported");
  assert.equal(resultsAvailabilityNote([historical]), "1 active campaign shows last reported results. Totals include available measurements only.");
  assert.equal(resultsAvailabilityNote([historical, historical, pending]), "Results are pending for 1 active campaign. 2 active campaigns show last reported results. Totals include available measurements only.");
  assert.equal(resultsAvailabilityNote([draft(), historical]), "1 draft has no reported results yet. 1 active campaign shows last reported results. Totals include available measurements only.");
});

test("active rows distinguish pending metrics from zero and historical values", () => {
  const pending = { ...draft({ positive_replies: 0 }), status: "active" };
  const render = (campaign: Campaign) => renderToStaticMarkup(createElement(CampaignTable, {
    campaigns: [campaign], selection: parseSelection({ client: campaign.client_id }), demo: false, activeOnly: true,
  }));
  const pendingHtml = render(pending);
  assert.match(pendingHtml, /Results pending/);
  assert.equal((pendingHtml.match(/—/g) || []).length, 5);
  assert.doesNotMatch(pendingHtml, /0%|class="progress"/);
  const historicalHtml = render({ ...pending, totals: { leads: 100, contacted: 10, unique_replies: 3, unique_auto_replies: 1, opportunities: 0 } });
  assert.match(historicalHtml, /Last reported/);
  assert.match(historicalHtml, /<td>10<\/td><td>2<\/td><td>20%<\/td><td>0<\/td>/);
  assert.doesNotMatch(historicalHtml, /—/);
});
