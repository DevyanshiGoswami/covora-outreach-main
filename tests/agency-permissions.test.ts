import assert from 'node:assert/strict';
import test from 'node:test';
import { agencyAccess } from '../src/lib/agency-permissions';
import { ownerList } from '../src/lib/owners';

test('agency membership alone never grants client controls; missing or malformed permissions fail closed', () => {
  assert.deepEqual(agencyAccess({ isOwner: true }), { isOwner: true, canManageClients: false });
  assert.deepEqual(agencyAccess({ isOwner: true, canManageClients: true }), { isOwner: true, canManageClients: true });
  for (const value of [undefined, false, 'true', 1, null]) assert.equal(agencyAccess({ isOwner: true, canManageClients: value }).canManageClients, false);
  assert.equal(agencyAccess({ isOwner: false, canManageClients: true }).canManageClients, false);
});
test('owner removal is an explicit capability, with old API responses defaulting to denied', () => {
  const data = { userId: '10000000-0000-4000-8000-000000000001', owners: [], invitations: [] };
  assert.equal(ownerList(data).canRemoveOwners, false);
  assert.equal(ownerList({ ...data, canRemoveOwners: true }).canRemoveOwners, true);
  for (const value of ['true', 1, null]) assert.throws(() => ownerList({ ...data, canRemoveOwners: value }));
});
