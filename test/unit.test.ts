// Runs against the built package (dist/), as n8n loads it.
// The parts of the nodes that need no server: the Standard Webhooks check (against its published reference vector),
// Simplify, and the retry-safe Idempotency-Key.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import { signatureValid } from '../dist/nodes/PostkeyTrigger/PostkeyTrigger.node.js';
import { idempotencyKeyFor, simplify } from '../dist/nodes/shared/transport.js';

test('the signature check takes the Standard Webhooks reference vector, and refuses anything changed', () => {
	// https://github.com/standard-webhooks/standard-webhooks (its test vector)
	const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
	const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek';
	const ts = '1614265330';
	const body = '{"test": 2432232314}';
	const sig = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=';
	assert.equal(signatureValid(secret, id, ts, sig, body, 1614265330), true);
	assert.equal(signatureValid(secret, id, ts, `v1,AAAA ${sig}`, body, 1614265330), true, 'two signatures during a rotation: either is enough');
	assert.equal(signatureValid(secret, id, ts, sig, body + ' ', 1614265330), false, 'another body');
	assert.equal(signatureValid(secret, 'msg_other', ts, sig, body, 1614265330), false, 'another id');
	assert.equal(signatureValid(secret, id, ts, sig, body, 1614265330 + 301), false, 'more than 5 minutes old');
	assert.equal(signatureValid('whsec_' + Buffer.from('another key 0123456789abcdef').toString('base64'), id, ts, sig, body, 1614265330), false, 'another secret');
	const mine = `v1,${createHmac('sha256', Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64')).update(`${id}.${ts}.${body}`).digest('base64')}`;
	assert.equal(mine, sig);
});

test('Simplify turns { untrusted, text } into the text, everywhere, and leaves everything else', () => {
	const event = { id: 'evt_1', data: { comment: { text: { untrusted: true, text: 'GUIDE please' } }, contact: { name: { untrusted: true, text: 'Ana', truncated: true }, handle: null }, list: [{ untrusted: false, text: 'ours' }], other: { untrusted: true, text: 'x', extra: 1 } } };
	assert.deepEqual(simplify(event), { id: 'evt_1', data: { comment: { text: 'GUIDE please' }, contact: { name: 'Ana', handle: null }, list: ['ours'], other: { untrusted: true, text: 'x', extra: 1 } } });
});

test('the Idempotency-Key is the same for the same item of the same run, and fits Postkey (1 to 100 printable)', () => {
	const ctx = (exec: string, node: string) => ({ getExecutionId: () => exec, getNode: () => ({ id: node }) }) as never;
	const a = idempotencyKeyFor(ctx('42', 'n1'), 0, 'post.schedule');
	assert.equal(idempotencyKeyFor(ctx('42', 'n1'), 0, 'post.schedule'), a, 'a retry of the item');
	for (const other of [idempotencyKeyFor(ctx('43', 'n1'), 0, 'post.schedule'), idempotencyKeyFor(ctx('42', 'n2'), 0, 'post.schedule'), idempotencyKeyFor(ctx('42', 'n1'), 1, 'post.schedule'), idempotencyKeyFor(ctx('42', 'n1'), 0, 'post.create')]) assert.notEqual(other, a);
	assert.match(a, /^[ -~]{1,100}$/);
});
