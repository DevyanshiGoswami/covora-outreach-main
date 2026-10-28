import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMENTS_CLIENT_ID as clientId, canComment, canManageComments, commentsAccess, commentsQuery, commentsUrl, commentPageFromResponse, commentDetailFromResponse, parseCommentInput, parseCommentStatus } from '../src/lib/comments';
import { commentsApiRequest } from '../src/lib/comments-transport';
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const request = { id, clientId, title: 'Update wording', status: 'open', version: 1, createdAt: '2026-10-21T20:00:00Z', updatedAt: '2026-10-21T20:00:00Z', authorName: 'Test member', replyCount: 0 };
const page = { clientId, enabled: true, permissions: { canComment: true, canManage: false }, requests: [request], hasMore: false };

test('comments scope uses real membership even in preview; viewers cannot write and only staff manage', () => {
  const workspace = { enabled: true, clientId, clientName: 'EPM', role: 'client_member' as const, clients: [], presentationMode: 'preview' as const };
  assert.equal(commentsAccess(workspace, clientId), true);
  assert.equal(commentsAccess({ ...workspace, enabled: false }, clientId), false);
  assert.equal(commentsAccess({ ...workspace, clientId: other }, other), false);
  assert.equal(commentsAccess(workspace, other), false);
  for (const role of ['client_admin', 'client_member', 'operator', 'agency_owner'] as const) assert.equal(canComment(role), true);
  for (const role of ['client_viewer', null] as const) assert.equal(canComment(role), false);
  for (const role of ['client_admin', 'client_member', 'client_viewer', null] as const) assert.equal(canManageComments(role), false);
  assert.equal(canManageComments('operator'), true);
  assert.equal(canManageComments('agency_owner'), true);
});
test('comment input rejects missing, oversized, wrong tenant, and malformed version values', () => {
  const input = { clientId, commandId: id, title: ' Update ', body: ' Please change this. ' };
  assert.equal(parseCommentInput(input, 'create')?.title, 'Update');
  for (const patch of [{ body: '' }, { body: ' '.repeat(20) }, { body: 'a'.repeat(5001) }, { title: 'a'.repeat(121) }, { clientId: other }, { commandId: 'bad' }]) assert.equal(parseCommentInput({ ...input, ...patch }, 'create'), null);
  assert.equal(parseCommentInput({ ...input, title: undefined, requestId: id }, 'reply')?.requestId, id);
  assert.equal(parseCommentInput(input, 'reply'), null);
  const status = { clientId, requestId: id, expectedVersion: '2', status: 'in_progress' };
  assert.equal(parseCommentStatus(status)?.expectedVersion, 2);
  for (const expectedVersion of ['0', '-1', '1.5', '2oops', '9007199254740992']) assert.equal(parseCommentStatus({ ...status, expectedVersion }), null);
  assert.equal(parseCommentStatus({ ...status, status: 'deleted' }), null);
});
test('comments responses validate tenant/thread, bounds and shapes while stripping unknown fields', () => {
  const parsed = commentPageFromResponse({ ...page, requests: [{ ...request, secret: 'private' }] }, clientId);
  assert.equal('secret' in parsed.requests[0], false);
  assert.equal(commentPageFromResponse({ ...page, requests: [{ ...request, authorName: '😀'.repeat(200) }] }, clientId).requests[0].authorName.length, 400);
  assert.throws(() => commentPageFromResponse({ ...page, clientId: other }, clientId));
  assert.throws(() => commentPageFromResponse({ ...page, requests: [{ ...request, clientId: other }] }, clientId));
  assert.throws(() => commentPageFromResponse({ ...page, requests: Array(26).fill(request) }, clientId));
  assert.throws(() => commentPageFromResponse({ ...page, permissions: { canComment: 'true', canManage: false } }, clientId));
  const detail = { clientId, request: { ...request, body: '<script>alert(1)</script>' }, messages: [{ id: other, requestId: id, clientId, body: 'Reply', authorName: 'Test teammate', createdAt: request.createdAt }], hasMore: false };
  assert.equal(commentDetailFromResponse(detail, clientId, id).request.body, '<script>alert(1)</script>');
  assert.throws(() => commentDetailFromResponse(detail, clientId, other));
  assert.throws(() => commentDetailFromResponse({ ...detail, messages: [{ ...detail.messages[0], clientId: other }] }, clientId, id));
  assert.throws(() => commentDetailFromResponse({ ...detail, messages: [{ ...detail.messages[0], requestId: other }] }, clientId, id));
});
test('filters and pagination reject arbitrary query values and preserve workspace in links', () => {
  assert.deepEqual(commentsQuery({ status: 'resolved', offset: '25', request: id, messageOffset: '50' }), { status: 'resolved', offset: 25, requestId: id, messageOffset: 50 });
  for (const offset of ['-25', '2', '25oops', '100025', '1000000']) assert.equal(commentsQuery({ offset }).offset, 0);
  assert.equal(commentsQuery({ status: ['open'], request: 'bad' }).requestId, null);
  const url = new URL(commentsUrl(clientId, { status: 'open', requestId: id, offset: 25, messageOffset: 50 }), 'https://example.com');
  assert.equal(url.pathname, '/comments'); assert.equal(url.searchParams.get('client'), clientId); assert.equal(url.searchParams.get('request'), id);
});
test('comment transport pins methods, paths, bearer authentication and no-store without leaking provider errors', async () => {
  const cases = [
    [{ kind: 'list', clientId, status: 'all', offset: 0 }, 'GET', `/api/outbound/comments?clientId=${clientId}&offset=0&status=all`],
    [{ kind: 'detail', clientId, requestId: id, offset: 25 }, 'GET', `/api/outbound/comments/${id}?clientId=${clientId}&offset=25`],
    [{ kind: 'create', body: { clientId, commandId: other, title: 'Request', body: 'Details' } }, 'POST', '/api/outbound/comments'],
    [{ kind: 'reply', requestId: id, body: { clientId, commandId: other, body: 'Reply' } }, 'POST', `/api/outbound/comments/${id}/replies`],
    [{ kind: 'status', requestId: id, body: { clientId, expectedVersion: 1, status: 'resolved' } }, 'PATCH', `/api/outbound/comments/${id}`],
  ] as const;
  for (const [operation, method, path] of cases) await commentsApiRequest('https://api.example.com', 'synthetic-token', operation, async (url, init) => {
    assert.equal(String(url), `https://api.example.com${path}`); assert.equal(init?.method, method); assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit'); assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-token');
    if ('body' in operation) assert.deepEqual(JSON.parse(String(init?.body)), operation.body); else assert.equal(init?.body, undefined);
    return Response.json({ ok: true });
  });
  for (const status of [400, 401, 403, 404, 409, 500]) await assert.rejects(commentsApiRequest('https://api.example.com', 'token', cases[0][0], async () => new Response('SECRET DEBUG CONTENT', { status })), error => error instanceof Error && !error.message.includes('SECRET'));
});
