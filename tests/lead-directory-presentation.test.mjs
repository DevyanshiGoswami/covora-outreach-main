import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("real lead verification is preserved in every workspace including previews", () => {
  const source = `
    import assert from 'node:assert/strict';
    import { loadLeadDirectoryPresentation } from './src/lib/lead-directory-presentation.ts';
    import { demoLeadDirectory } from './src/lib/demo-verified-leads.ts';
    import { parseLeadDirectoryQuery } from './src/lib/verified-leads.ts';
    import { resolveWorkspace } from './src/lib/access.ts';
    const id = 'a2bb9be7-018a-4750-97a0-28e48bbb18b9';
    const epm = '26a2cffb-47f4-4231-9195-b4f772751c6d';
    const workspace = resolveWorkspace([{client_id:id,client_name:'Ice Shaker',role:'client_admin',presentation_mode:'preview'}],id);
    const query = parseLeadDirectoryQuery({email:'verified',role:'owners-executives',sort:'name',page:'2'});
    const originalQuery = structuredClone(query);
    const calls = [], snapshots = [];
    const load = async (clientId,q) => {
      calls.push({clientId,query:structuredClone(q)});
      const page = demoLeadDirectory(clientId,q);
      snapshots.push([page,structuredClone(page)]);
      return page;
    };
    const result = await loadLeadDirectoryPresentation(workspace,query,load);
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0].query,query);
    assert.ok(result.page.leads.every(lead=>lead.emailVerification==='verified'));
    const mixed = await loadLeadDirectoryPresentation(workspace,parseLeadDirectoryQuery({}),load);
    assert.ok(mixed.page.leads.some(lead=>lead.emailVerification!=='verified'));
    assert.equal(mixed.page.summary.verifiedEmail,demoLeadDirectory(id,parseLeadDirectoryQuery({})).summary.verifiedEmail);
    for (const [page,before] of snapshots) assert.deepEqual(page,before);
    assert.deepEqual(query,originalQuery);
    for (const modified of [
      {...workspace,presentationMode:'live'},
      {...workspace,presentationMode:undefined},
      {...workspace,clientId:epm},
      {...workspace,clientId:'10000000-0000-4000-8000-000000000001'},
    ]) {
      calls.length=0;
      const actual=await loadLeadDirectoryPresentation(modified,query,load);
      assert.equal(actual.sampleVerifiedEmailCount,undefined);
      assert.equal(calls.length,1);
      assert.deepEqual(calls[0].query,query);
      assert.ok(actual.page.leads.every(lead=>lead.emailVerification==='verified'));
    }
    for (const modified of [{...workspace,enabled:false},{...workspace,role:null},{...workspace,clientId:null},resolveWorkspace([],id)]) {
      assert.equal(await loadLeadDirectoryPresentation(modified,query,()=>{throw new Error('Unauthorized read');}),null);
    }
    await assert.rejects(loadLeadDirectoryPresentation(workspace,query,async()=>demoLeadDirectory(epm,parseLeadDirectoryQuery({}))),/workspace mismatch/);
    await assert.rejects(loadLeadDirectoryPresentation(workspace,query,async()=>{throw new Error('Service unavailable');}),/Service unavailable/);
  `;
  const run = spawnSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--input-type=module", "-e", source], { encoding: "utf8", timeout: 20000, env: { ...process.env, NODE_ENV: "test" } });
  assert.equal(run.status, 0, run.stderr);
});
