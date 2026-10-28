import test from 'node:test';
import assert from 'node:assert/strict';
import { adminIntegrationsFromResponse, integrationErrorFromResponse } from '../src/lib/admin-integrations';
test('admin integration DTO retains only display metadata and rejects malformed state',()=>{
  const row={id:'10000000-0000-4000-8000-000000000001',channel:'email',label:'Managed connection',version:1,verifiedAt:'2026-10-16T00:00:00Z',checkedAt:'2026-10-16T00:00:00Z',checkError:false,assigned:false};
  const result=adminIntegrationsFromResponse({integrations:[{...row,apiKey:'synthetic-sensitive-value',workspaceId:'private-scope',credentialRef:'private-ref'}]});
  assert.deepEqual(result,[row]);
  for(const changes of [{version:0},{channel:'invalid'},{assigned:'false'},{checkedAt:'invalid'}]) assert.throws(()=>adminIntegrationsFromResponse({integrations:[{...row,...changes}]}));
});
test('integration failures expose fixed actionable messages and discard untrusted details', () => {
  for (const code of ['key_rejected', 'provider_access_denied', 'provider_rate_limited', 'provider_unavailable', 'key_verification_failed']) {
    const error = integrationErrorFromResponse({ code, error: 'private upstream details', apiKey: 'private-key' });
    assert.ok(error);
    assert.ok(!error.message.includes('private'));
  }
  assert.match(integrationErrorFromResponse({ code: 'key_rejected' })!.message, /401/);
  for (const value of [null, {}, { code: '__proto__' }, { code: 'constructor' }, { code: 'private-key' }, { error: 'private error' }]) assert.equal(integrationErrorFromResponse(value), null);
});
