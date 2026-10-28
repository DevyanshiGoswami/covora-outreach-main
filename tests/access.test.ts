import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspace, canRequestSetup, canManageSetup, agencyWorkspaces } from "../src/lib/access";
const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const rows = [{client_id:a,client_name:"Company A",role:"operator"},{client_id:b,client_name:"Company B",role:"client_viewer"}];
test("workspace selection uses explicit memberships and never falls back from an unauthorized company",()=>{
  assert.equal(resolveWorkspace(rows,a).role,"operator");
  assert.equal(resolveWorkspace(rows,b).role,"client_viewer");
  assert.equal(resolveWorkspace(rows,"guessed").enabled,false);
  assert.equal(resolveWorkspace(rows,"guessed").clientId,null);
  assert.equal(resolveWorkspace([]).enabled,false);
  assert.equal(resolveWorkspace([{client_id:a,client_name:"Legacy admin",role:"admin"}]).enabled,false);
});
test("setup capabilities distinguish client admins, read-only teammates and agency assignments",()=>{
  assert.equal(canRequestSetup("client_admin"),true);
  for(const role of ["client_viewer","client_member",null] as const) assert.equal(canRequestSetup(role),false);
  assert.equal(canManageSetup("client_admin"),false);
  assert.equal(canManageSetup("operator"),true);
  assert.equal(canManageSetup("agency_owner"),true);
  assert.deepEqual(agencyWorkspaces(resolveWorkspace(rows).clients).map(w=>w.id),[a]);
});
