// Runs against the built package (dist/) and a stand-in server on this computer that records what the node sends:
// the video edit and template operations, the "From List" pickers and the dropdowns. No Postkey server needed.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import { Postkey } from '../dist/nodes/Postkey/Postkey.node.js';
import { executeContext, hookContext, type World } from './fake.mts';

type Seen = { method: string; path: string; query: Record<string, string>; body: unknown; key: string | undefined };
const seen: Seen[] = [];
const answers: Record<string, unknown> = {
	'GET /api/v1/edits': { data: [{ id: 'e1', title: 'Launch day' }, { id: 'e2', title: null }], has_more: false },
	'GET /api/v1/edit-templates': { formats: [{ id: 'talking', name: 'Talking head', blurb: 'One person to camera' }], saved: [{ id: 't1', name: 'Weekly tips' }, { id: 't2', name: 'Montage' }] },
	'GET /api/v1/contacts': { data: [{ id: 'c1', name: { untrusted: true, text: 'Ana' }, handle: { untrusted: true, text: 'ana.makes' } }], has_more: true, next_cursor: 'next-1' },
	'GET /api/v1/social-accounts': { data: [{ id: 'a1', network: 'instagram', handle: 'postkeyhq' }], has_more: false },
	'GET /api/v1/automation-templates': { data: [{ key: 'comment_to_dm', name: 'Comment to DM', does: 'Sends a link' }], has_more: false },
};
let server: ReturnType<typeof createServer>;
const world: World = { base: '', key: 'pkk_test', staticData: {}, executionId: 'run-1', webhookUrl: '' };

before(async () => {
	server = createServer((req, res) => {
		let raw = '';
		req.on('data', (c) => (raw += c));
		req.on('end', () => {
			const url = new URL(req.url ?? '/', 'http://x');
			seen.push({ method: req.method ?? '', path: url.pathname, query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : undefined, key: req.headers['idempotency-key'] as string | undefined });
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answers[`${req.method} ${url.pathname}`] ?? { ok: true }));
		});
	});
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	world.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const run = async (params: Record<string, unknown>) => {
	seen.length = 0;
	const out = (await new Postkey().execute.call(executeContext(world, { simplify: false, ...params }) as never))[0].map((x) => x.json as Record<string, unknown>);
	return { out, sent: seen.at(-1)! };
};
const ID = '4850775a-6b1c-4f0e-9a51-2a1f6f7c0d11';

test('Video Edit: Create sends only what was filled in, lists as lists, the template picker as its ID', async () => {
	const { sent } = await run({ resource: 'videoEdit', operation: 'create', editFields: { media_ids: `${ID}, ${ID}`, words: 'Postkey, Ana', template: { mode: 'list', value: 't1' }, captions: false, title: '', roles: [] } });
	assert.equal(`${sent.method} ${sent.path}`, 'POST /api/v1/edits');
	assert.deepEqual(sent.body, { media_ids: [ID, ID], words: ['Postkey', 'Ana'], template: 't1', captions: false });
	assert.match(sent.key ?? '', /^n8n-[0-9a-f]{40}$/);
});

test('Video Edit: Clone Style sends the template name and exactly one video', async () => {
	const { sent } = await run({ resource: 'videoEdit', operation: 'cloneStyle', cloneName: 'Morning style', cloneMediaId: ID });
	assert.deepEqual(sent.body, { clone: 'Morning style', media_ids: [ID] });
});

test('Video Edit: Create Shorts sends the clips, and refuses none', async () => {
	const { sent } = await run({ resource: 'videoEdit', operation: 'createShorts', sourceEditId: ID, clips: { clip: [{ from: 's1', to: 's4', title: 'The hook', reason: '' }] }, anyLength: true });
	assert.deepEqual(sent.body, { from_edit: ID, clips: [{ from: 's1', to: 's4', title: 'The hook' }], any_length: true });
	await assert.rejects(run({ resource: 'videoEdit', operation: 'createShorts', sourceEditId: ID, clips: {} }), /'Clips' is empty/);
});

test('Video Edit: Get, Update and Undo Change', async () => {
	const got = await run({ resource: 'videoEdit', operation: 'get', editId: ID, editGetOptions: { render: true, page: 2 } });
	assert.equal(got.sent.path, `/api/v1/edits/${ID}`);
	assert.deepEqual(got.sent.query, { render: 'true', page: '2' });
	const changed = await run({ resource: 'videoEdit', operation: 'update', editId: ID, changes: '[{"op":"set_title","title":"New"}]', changeNote: 'Shorter title' });
	assert.equal(changed.sent.path, `/api/v1/edits/${ID}/changes`);
	assert.deepEqual(changed.sent.body, { ops: [{ op: 'set_title', title: 'New' }], note: 'Shorter title' });
	await assert.rejects(run({ resource: 'videoEdit', operation: 'update', editId: ID, changes: '[{' }), /'Changes' is not valid JSON/);
	await assert.rejects(run({ resource: 'videoEdit', operation: 'update', editId: ID, changes: '[]' }), /'Changes' has no changes/);
	const undone = await run({ resource: 'videoEdit', operation: 'undoChange', editId: ID, changeId: ID });
	assert.equal(undone.sent.path, `/api/v1/edits/${ID}/undo`);
	assert.deepEqual(undone.sent.body, { change_id: ID });
});

test('Video Edit Template: formats and saved templates come from one answer, one item each', async () => {
	const saved = await run({ resource: 'videoEditTemplate', operation: 'getAll', returnAll: true });
	assert.deepEqual(saved.out.map((t) => t.id), ['t1', 't2']);
	const one = await run({ resource: 'videoEditTemplate', operation: 'getAll', returnAll: false, limit: 1 });
	assert.equal(one.out.length, 1);
	const formats = await run({ resource: 'videoEditTemplate', operation: 'getFormats', returnAll: true });
	assert.deepEqual(formats.out.map((t) => t.id), ['talking']);
});

test('Video Edit Template: Get, Create and Update', async () => {
	const got = await run({ resource: 'videoEditTemplate', operation: 'get', templateId: ID });
	assert.deepEqual(got.sent.query, { template: ID });
	const made = await run({ resource: 'videoEditTemplate', operation: 'create', templateEditId: ID, templateName: 'Weekly tips' });
	assert.deepEqual(made.sent.body, { edit_id: ID, name: 'Weekly tips' });
	const changed = await run({ resource: 'videoEditTemplate', operation: 'update', templateId: ID, templateUpdate: { brief: 'Fast cuts', look: '{"captions":{"size":"l"}}', name: '' } });
	assert.deepEqual(changed.sent.body, { template_id: ID, brief: 'Fast cuts', look: { captions: { size: 'l' } } });
	await assert.rejects(run({ resource: 'videoEditTemplate', operation: 'update', templateId: ID, templateUpdate: { look: '{}' } }), /'Update Fields' is empty/);
});

test('the pickers: one page a call, named for people, searched by the list or on the page', async () => {
	const node = new Postkey();
	const ctx = () => hookContext(world, {}) as never;
	seen.length = 0;
	const contacts = await node.methods.listSearch.searchContacts.call(ctx(), 'ana', 'cur-0');
	assert.deepEqual(contacts, { results: [{ name: 'Ana @ana.makes', value: 'c1' }], paginationToken: 'next-1' });
	assert.deepEqual(seen.at(-1)!.query, { cursor: 'cur-0', search: 'ana' });
	const edits = await node.methods.listSearch.searchEdits.call(ctx(), 'launch');
	assert.deepEqual(edits, { results: [{ name: 'Launch day', value: 'e1' }] }, 'no search on that list: the page is filtered; an untitled edit is named by its ID');
	assert.deepEqual((await node.methods.listSearch.searchEdits.call(ctx())).results[1], { name: 'e2', value: 'e2' });
	assert.deepEqual((await node.methods.listSearch.searchEditTemplates.call(ctx())).results, [{ name: 'Weekly tips', value: 't1' }, { name: 'Montage', value: 't2' }]);
	assert.deepEqual(await node.methods.loadOptions.getSocialAccounts.call(ctx()), [{ name: 'postkeyhq (instagram)', value: 'a1' }]);
	assert.deepEqual(await node.methods.loadOptions.getAutomationTemplates.call(ctx()), [{ name: 'Comment to DM', value: 'comment_to_dm', description: 'Sends a link' }]);
	assert.deepEqual(await node.methods.loadOptions.getEditFormats.call(ctx()), [{ name: 'Talking head', value: 'talking', description: 'One person to camera' }]);
});

test('a post goes to the ticked social accounts, as a list', async () => {
	const { sent } = await run({ resource: 'post', operation: 'create', postType: 'text', postFields: { caption: 'Hello', social_account_ids: ['a1', 'a2'] } });
	assert.deepEqual(sent.body, { type: 'text', caption: 'Hello', social_account_ids: ['a1', 'a2'] });
});
