import assert from 'node:assert/strict';
import test from 'node:test';
import { personChannelAction, peopleFromResponse, connectionNextStep, type OutreachPerson } from '../src/lib/onboarding';
const id = '10000000-0000-4000-8000-000000000001';
const person: OutreachPerson = { id, name: 'Member', email: 'member@example.test', source: 'team', isSelf: true, canConnect: true, role: 'client_member', access: 'active', connections: [] };
test('connection progress accepts only neutral explicit steps and never infers verification from pending', () => {
  assert.equal(connectionNextStep('verification_code'), 'verification_code');
  for (const value of [undefined, null, 'pending', 'PinRequired', { pinRequired: true }, 'arbitrary service text']) assert.equal(connectionNextStep(value), undefined);
});
test('each channel has a direct action, and managers cannot sign in as teammates', () => {
  assert.deepEqual(personChannelAction(person, 'email'), { kind: 'connect', label: 'Connect email' });
  assert.deepEqual(personChannelAction(person, 'linkedin'), { kind: 'connect', label: 'Connect LinkedIn' });
  assert.equal(personChannelAction({ ...person, canConnect: false, isSelf: false }, 'email'), null);
});
test('removal permission is independent from self sign-in and fails closed on older responses', () => {
  const connection = { id, channel: 'email' as const, state: 'connected' as const, canContinue: false, updatedAt: '2026-10-21T00:00:00Z' };
  assert.equal(personChannelAction({ ...person, connections: [connection] }, 'email'), null);
  assert.deepEqual(personChannelAction({ ...person, canConnect: false, connections: [{ ...connection, canDisconnect: true }] }, 'email'), { kind: 'disconnect', label: 'Disconnect' });
  for (const state of ['disconnecting', 'disconnect_uncertain'] as const) {
    assert.deepEqual(personChannelAction({ ...person, connections: [{ ...connection, state, canDisconnect: true }] }, 'email'), { kind: 'check-disconnect', label: 'Check disconnection' });
  }
  assert.equal(personChannelAction({ ...person, connections: [{ ...connection, state: 'disconnected' }] }, 'email')?.kind, 'connect');
});
test('account identity and removal controls use validated metadata and exclude private details', () => {
  const response = { people: [{ ...person, connections: [{ id, channel: 'linkedin', state: 'connected', canContinue: false, canDisconnect: true, address: 'https://www.linkedin.com/in/person', updatedAt: '2026-10-21T00:00:00Z', remoteAccount: 'private-id' }] }] };
  const result = peopleFromResponse(response);
  assert.equal(result[0].connections[0].canDisconnect, true);
  assert.equal(JSON.stringify(result).includes('private-id'), false);
  assert.throws(() => peopleFromResponse({ people: [{ ...person, connections: [{ ...response.people[0].connections[0], canDisconnect: 'yes' }] }] }));
});
