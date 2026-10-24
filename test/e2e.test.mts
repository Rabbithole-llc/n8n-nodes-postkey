// Runs against the built package (dist/), as n8n loads it, and a real Postkey server: the nodes' own code, through
// n8n-shaped contexts (./fake.ts), against the REST API. Skipped unless both are set:
//   POSTKEY_E2E_BASE=<a Postkey test server> POSTKEY_E2E_KEY=<an agent key> npm test
// The key must ask first (nothing reaches a real person) and include Webhooks. The trigger test has Postkey send to
// a receiver on this computer, so it needs a test server that may send to 127.0.0.1. It deletes what it makes.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import { Postkey } from '../dist/nodes/Postkey/Postkey.node.js';
import { PostkeyTrigger } from '../dist/nodes/PostkeyTrigger/PostkeyTrigger.node.js';
import { executeContext, hookContext, webhookContext, type World } from './fake.mts';

const BASE = process.env.POSTKEY_E2E_BASE?.replace(/\/+$/, '');
const KEY = process.env.POSTKEY_E2E_KEY?.trim();
const skip = !BASE || !KEY;
const world: World = { base: BASE ?? '', key: KEY ?? '', staticData: {}, executionId: `e2e-${Date.now()}`, webhookUrl: '' };
const got: { headers: Record<string, string>; body: string }[] = [];
let server: ReturnType<typeof createServer> | null = null;

const run = async (params: Record<string, unknown>) => (await new Postkey().execute.call(executeContext(world, { simplify: false, ...params }) as never))[0].map((x) => x.json as Record<string, unknown>);

before(async () => {
	if (skip) return;
	server = createServer((req, res) => {
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			got.push({ headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])), body });
			res.writeHead(204).end();
		});
	});
	await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
	world.webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;
});

after(() => {
	server?.close();
});

test('the profile, the social accounts, and lists that page (Return All, Limit)', { skip }, async () => {
	const [me] = await run({ resource: 'profile', operation: 'get' });
	assert.equal((me.connection as Record<string, unknown>).send_policy, 'held_in_postkey');
	const accounts = await run({ resource: 'socialAccount', operation: 'getAll' });
	assert.ok(accounts.length >= 1);
	const two = await run({ resource: 'post', operation: 'getAll', returnAll: false, limit: 2 });
	assert.equal(two.length, 2, 'one item per post, at most the limit');
	const simplified = await run({ resource: 'contact', operation: 'getAll', returnAll: false, limit: 3, simplify: true });
	assert.ok(simplified.every((c) => typeof c.name === 'string' || c.name === null), 'Simplify: names as strings');
	const raw = await run({ resource: 'contact', operation: 'getAll', returnAll: false, limit: 3 });
	assert.ok(raw.some((c) => (c.name as Record<string, unknown>)?.untrusted === true), 'off: outside text is marked');
});

test('a post: draft, schedule (held: the key asks first), the same item again does not schedule twice, unschedule, delete', { skip }, async () => {
	const accounts = await run({ resource: 'socialAccount', operation: 'getAll' });
	const textual = accounts.find((a) => a.active === true && ['x', 'threads', 'linkedin', 'facebook', 'bluesky'].includes(String(a.network)));
	const [post] = await run({ resource: 'post', operation: 'create', postType: 'text', postFields: { caption: 'n8n e2e draft. Safe to delete.', ...(textual ? { social_account_ids: String(textual.id) } : {}) } });
	assert.ok(typeof post.id === 'string');
	const [held] = await run({ resource: 'post', operation: 'schedule', postId: post.id, when: 'queue' });
	assert.equal(held.status, 'waiting_for_approval', 'not an error: a person approves it in Postkey');
	const [again] = await run({ resource: 'post', operation: 'schedule', postId: post.id, when: 'queue' });
	assert.deepEqual(again, held, 'n8n retried the item: Postkey answers the first answer again');
	const [draft] = await run({ resource: 'post', operation: 'unschedule', postId: post.id });
	assert.equal(draft.id, post.id);
	const [gone] = await run({ resource: 'post', operation: 'delete', postId: post.id });
	assert.equal(gone.deleted, true);
});

test('an error is Postkey\'s own code and sentence', { skip }, async () => {
	await assert.rejects(run({ resource: 'post', operation: 'get', postId: '00000000-0000-4000-8000-000000000000' }), (e: Error & { description?: string; httpCode?: string }) => e.httpCode === '404' && /Postkey code: not_found/.test(e.description ?? ''));
});

test('the trigger: switched on it makes its endpoint, a delivery\'s signature is checked, switched off it deletes it', { skip }, async () => {
	const params = { events: ['approval.requested', 'comment.received'], simplify: false };
	const trigger = new PostkeyTrigger();
	const hooks = trigger.webhookMethods.default;
	assert.equal(await hooks.checkExists.call(hookContext(world, params) as never), false);
	assert.equal(await hooks.create.call(hookContext(world, params) as never), true);
	assert.match(String(world.staticData.secret), /^whsec_/);
	assert.equal(await hooks.checkExists.call(hookContext(world, params) as never), true);
	assert.equal(await hooks.checkExists.call(hookContext(world, { ...params, events: ['post.published'] }) as never), false, 'other events: made again');
	assert.equal(await hooks.create.call(hookContext(world, params) as never), true);

	const id = String(world.staticData.endpointId);
	await fetch(`${BASE}/api/v1/webhook-endpoints/${id}/test`, { method: 'POST', headers: { authorization: `Bearer ${world.key}` } });
	for (let i = 0; i < 40 && !got.length; i++) await new Promise((r) => setTimeout(r, 100));
	assert.equal(got.length, 1, 'the test event arrived');
	const ok = webhookContext(world, params, got[0]);
	const out = await trigger.webhook.call(ok.ctx as never);
	assert.equal((out.workflowData?.[0][0].json as Record<string, unknown>).type, 'postkey.test');
	const forged = webhookContext(world, params, { headers: got[0].headers, body: got[0].body.replace('postkey.test', 'comment.received') });
	const refused = await trigger.webhook.call(forged.ctx as never);
	assert.equal(refused.noWebhookResponse, true);
	assert.equal(forged.response().status, 401, 'a changed body is refused');

	assert.equal(await hooks.delete.call(hookContext(world, params) as never), true);
	const after = await fetch(`${BASE}/api/v1/webhook-endpoints/${id}`, { headers: { authorization: `Bearer ${world.key}` } });
	assert.equal(after.status, 404, 'the endpoint is gone');
});

test('a file from the input goes to the media library (the place, the bytes, the finish)', { skip }, async () => {
	const [media] = await run({ resource: 'media', operation: 'upload', binaryPropertyName: 'data', mediaTitle: 'n8n e2e', __binary: { data: { fileName: 'n8n-e2e.png', mimeType: 'image/png', data: Buffer.alloc(1024) } } });
	const m = media.media as Record<string, unknown>;
	assert.ok(typeof m.id === 'string');
	assert.equal(m.kind, 'image');
});
