import test from "node:test";
import assert from "node:assert/strict";
import { canUseLiveWorkspace, isPreviewWorkspace, resolveWorkspace } from "../src/lib/access";
import { canManageClientAccounts } from "../src/lib/accounts";
import { EMPTY_DATA, parseSelection } from "../src/lib/model";
import { loadWorkspacePresentation } from "../src/lib/workspace-presentation";

const client = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const memberships = [{ client_id: client, client_name: "Preview Company", role: "client_admin", presentation_mode: "preview" }, { client_id: other, client_name: "Live Company", role: "operator", presentation_mode: "live" }];

test("preview mode follows only the selected authorized workspace and never grants membership", () => {
  const preview = resolveWorkspace(memberships, client);
  assert.equal(preview.presentationMode, "preview");
  assert.equal(isPreviewWorkspace(preview), true);
  assert.equal(isPreviewWorkspace(resolveWorkspace(memberships, other)), false);
  assert.equal(isPreviewWorkspace(resolveWorkspace(memberships, "30000000-0000-4000-8000-000000000003")), false);
  assert.equal(isPreviewWorkspace(resolveWorkspace([{ ...memberships[0], role: "admin" }], client)), false);
  assert.equal(resolveWorkspace([{ ...memberships[0], presentation_mode: "untrusted" }], client).presentationMode, "live");
  assert.equal(resolveWorkspace([{ client_id: client, client_name: "Legacy row", role: "client_admin" }], client).presentationMode, "live");
});

test("live conversation and account capabilities fail closed for preview and foreign workspaces", () => {
  const preview = resolveWorkspace(memberships, client);
  const live = resolveWorkspace(memberships, other);
  assert.equal(canUseLiveWorkspace(preview, client), false);
  assert.equal(canManageClientAccounts({ ...preview, role: "agency_owner" }, client), false);
  assert.equal(canUseLiveWorkspace(live, other), true);
  assert.equal(canManageClientAccounts(live, other), true);
  assert.equal(canUseLiveWorkspace(live, client), false);
  assert.equal(canUseLiveWorkspace({ ...live, enabled: false }, other), false);
});

test("every preview dashboard section stays local, even when its sample configuration is missing", async () => {
  const workspace = resolveWorkspace(memberships, client);
  for (const view of ["overview", "campaigns", "inbox", "linkedin"]) {
    let liveCalls = 0;
    const liveRead = async (): Promise<never> => { liveCalls++; throw new Error("A preview must not call live services"); };
    const presentation = await loadWorkspacePresentation(workspace, parseSelection({ view }), { preview: () => null, results: liveRead, conversations: liveRead });
    assert.equal(liveCalls, 0);
    assert.equal(presentation.preview, true);
    assert.deepEqual(presentation.conversations, { conversations: [], nextCursor: null });
    assert.deepEqual(presentation.data, EMPTY_DATA);
  }
});

test("live workspaces never consume samples and real loading failures are not replaced with demo success", async () => {
  const workspace = resolveWorkspace(memberships, other);
  let previewCalls = 0;
  const preview = () => { previewCalls++; return null; };
  const selected = parseSelection({ view: "overview" });
  const result = await loadWorkspacePresentation(workspace, selected, { preview, results: async () => EMPTY_DATA, conversations: async () => { throw new Error("Not needed"); } });
  assert.equal(result.preview, false);
  assert.equal(previewCalls, 0);
  await assert.rejects(loadWorkspacePresentation(workspace, selected, { preview, results: async () => { throw new Error("Live data unavailable"); }, conversations: async () => ({ conversations: [], nextCursor: null }) }), /Live data unavailable/);
  assert.equal(previewCalls, 0);
});

test("unauthorized selection cannot load any preview or live workspace data", async () => {
  const workspace = resolveWorkspace(memberships, "forbidden");
  const fail = () => { throw new Error("Must not load"); };
  const data = await loadWorkspacePresentation(workspace, parseSelection({}), { preview: fail, results: fail, conversations: fail });
  assert.equal(data.preview, false);
  assert.deepEqual(data.data, EMPTY_DATA);
});
