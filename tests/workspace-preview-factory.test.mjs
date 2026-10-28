import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("server-only preview factory is tenant-bound and contains only explicitly synthetic prospect activity", () => {
  const source = `
    import assert from 'node:assert/strict';
    import { workspacePreview } from './src/lib/workspace-preview.ts';
    const id = 'a2bb9be7-018a-4750-97a0-28e48bbb18b9';
    const workspace = { clientId: id, clientName: 'Ice Shaker', role: 'client_admin', clients: [], enabled: true, presentationMode: 'preview' };
    const result = workspacePreview(workspace);
    assert.ok(result);
    assert.equal(workspacePreview({ ...workspace, presentationMode: 'live' }), null);
    assert.equal(workspacePreview({ ...workspace, enabled: false }), null);
    assert.equal(workspacePreview({ ...workspace, clientId: '10000000-0000-4000-8000-000000000001' }), null);
    assert.equal(result.connections.filter(item => item.channel === 'email').length, 3);
    assert.equal(result.connections.filter(item => item.channel === 'linkedin').length, 1);
    assert.equal(result.details.length, 8);
    assert.ok(result.details.some(item => item.channel === 'linkedin'));
    assert.ok(result.details.filter(item => item.channel === 'email').every(item => item.contactAddress.endsWith('@example.com')));
    assert.ok(result.data.leads.every(item => item.email.endsWith('@example.com')));
    assert.ok(result.details.every(item => item.clientId === id && item.commands.length === 0));
    assert.equal(result.data.campaigns.reduce((sum, item) => sum + item.totals.contacted, 0), 8420);
    assert.equal(result.data.campaigns.reduce((sum, item) => sum + item.totals.unique_replies - item.totals.unique_auto_replies, 0), 600);
    assert.equal(result.data.campaigns.reduce((sum, item) => sum + item.totals.opportunities, 0), 30);
    assert.ok(result.data.campaigns.every(item => item.synced_at === null));
    for (const campaign of result.data.campaigns) {
      const daily = result.data.daily.filter(item => item.campaign_id === campaign.id);
      assert.equal(daily.reduce((sum, item) => sum + item.sent, 0), campaign.totals.sent);
      assert.equal(daily.reduce((sum, item) => sum + item.contacted, 0), campaign.totals.contacted);
      assert.equal(daily.reduce((sum, item) => sum + item.unique_replies, 0), campaign.totals.unique_replies);
      assert.equal(daily.reduce((sum, item) => sum + item.auto_replies, 0), campaign.totals.unique_auto_replies);
      assert.equal(daily.reduce((sum, item) => sum + item.opportunities, 0), campaign.totals.opportunities);
    }
    assert.deepEqual(workspacePreview(workspace), result);
    console.log('preview factory assertions passed');
  `;
  const run = spawnSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--input-type=module", "-e", source], { encoding: "utf8", timeout: 20000, env: { ...process.env, NODE_ENV: "production" } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /preview factory assertions passed/);
});


test("EPM preview has its own recruiting content, four sample inboxes, and isolated fixture identities", () => {
  const source = `
    import assert from 'node:assert/strict';
    import { workspacePreview } from './src/lib/workspace-preview.ts';
    const iceId = 'a2bb9be7-018a-4750-97a0-28e48bbb18b9';
    const epmId = '26a2cffb-47f4-4231-9195-b4f772751c6d';
    const workspace = { clientId: epmId, clientName: 'Elite Performance Medical', role: 'client_admin', clients: [], enabled: true, presentationMode: 'preview' };
    const epm = workspacePreview(workspace);
    const ice = workspacePreview({ ...workspace, clientId: iceId, clientName: 'Ice Shaker' });
    assert.ok(epm && ice);
    const senders = ['matt@teamepm.com', 'anthony@teamepm.com', 'dean@teamepm.com', 'julia@teamepm.com'];
    assert.deepEqual(epm.connections.filter(item => item.channel === 'email').map(item => item.address), senders);
    assert.deepEqual(new Set(epm.details.filter(item => item.channel === 'email').map(item => item.senderLabel)), new Set(senders));
    assert.deepEqual(epm.connections.find(item => item.channel === 'linkedin'), { channel: 'linkedin', name: 'Telly Fricke', address: 'Telly Fricke', profileUrl: 'https://www.linkedin.com/in/telly-fricke-1b9183ba/' });
    assert.equal(epm.details.filter(item => item.channel === 'linkedin').length, 3);
    assert.ok(epm.details.filter(item => item.channel === 'linkedin').every(item => item.senderLabel === 'Telly Fricke'));
    assert.ok(epm.details.every(item => item.clientId === epmId && item.commands.length === 0));
    assert.ok(epm.details.filter(item => item.channel === 'email').every(item => item.contactAddress.endsWith('@example.com')));
    assert.ok(epm.data.leads.every(item => item.email.endsWith('@example.com')));
    assert.ok(epm.data.campaigns.every(item => item.client_id === epmId && item.synced_at === null));
    assert.ok(epm.details.every(item => item.messages[0].bodyText.includes('Elite Performance Medical')));
    assert.ok(epm.data.steps.every(item => item.body_text.includes('medical device sales')));
    assert.doesNotMatch(JSON.stringify(epm), /ice.?shaker|Chris Gronkowski|Northstar Events/i);
    assert.doesNotMatch(JSON.stringify(ice), /teamepm|Elite Performance Medical|Telly Fricke/i);
    assert.deepEqual(epm.data.campaigns.map(item => item.totals), ice.data.campaigns.map(item => item.totals));
    const ids = preview => [
      ...preview.data.campaigns.map(item => item.id),
      ...preview.data.leads.map(item => item.id),
      ...preview.details.flatMap(item => [item.id, ...item.messages.map(message => message.id)]),
    ];
    const iceIds = new Set(ids(ice));
    const epmIds = ids(epm);
    assert.equal(new Set(epmIds).size, epmIds.length);
    assert.ok(epmIds.every(id => !iceIds.has(id)));
    assert.deepEqual(workspacePreview(workspace), epm);
    epm.details[0].messages[0].bodyText = 'Local draft mutation';
    epm.connections[0].address = 'changed@example.com';
    assert.notEqual(workspacePreview(workspace).details[0].messages[0].bodyText, 'Local draft mutation');
    assert.equal(workspacePreview(workspace).connections[0].address, senders[0]);
  `;
  const run = spawnSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--input-type=module", "-e", source], { encoding: "utf8", timeout: 20000, env: { ...process.env, NODE_ENV: "production" } });
  assert.equal(run.status, 0, run.stderr);
});

test("configured previews require an active selected membership and exact client identity", () => {
  const source = `
    import assert from 'node:assert/strict';
    import { workspacePreview } from './src/lib/workspace-preview.ts';
    import { resolveWorkspace } from './src/lib/access.ts';
    const id = '26a2cffb-47f4-4231-9195-b4f772751c6d';
    const rows = [{ client_id: id, client_name: 'Elite Performance Medical', role: 'client_admin', presentation_mode: 'preview' }];
    const workspace = resolveWorkspace(rows, id);
    assert.ok(workspacePreview(workspace));
    assert.equal(workspacePreview({ ...workspace, enabled: false }), null);
    assert.equal(workspacePreview({ ...workspace, role: null }), null);
    assert.equal(workspacePreview({ ...workspace, clientId: null }), null);
    assert.equal(workspacePreview({ ...workspace, presentationMode: 'live' }), null);
    assert.equal(workspacePreview({ ...workspace, presentationMode: undefined }), null);
    assert.equal(workspacePreview({ ...workspace, clientId: '10000000-0000-4000-8000-000000000001' }), null);
    assert.equal(workspacePreview({ ...workspace, clientId: '__proto__' }), null);
    assert.equal(workspacePreview(resolveWorkspace([], id)), null);
    assert.equal(workspacePreview(resolveWorkspace(rows, 'a2bb9be7-018a-4750-97a0-28e48bbb18b9')), null);
    assert.equal(workspacePreview(resolveWorkspace([{ ...rows[0], role: 'admin' }], id)), null);
    assert.ok(workspacePreview({ ...workspace, clientName: 'A renamed authorized workspace' }));
  `;
  const run = spawnSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--input-type=module", "-e", source], { encoding: "utf8", timeout: 20000, env: { ...process.env, NODE_ENV: "production" } });
  assert.equal(run.status, 0, run.stderr);
});
