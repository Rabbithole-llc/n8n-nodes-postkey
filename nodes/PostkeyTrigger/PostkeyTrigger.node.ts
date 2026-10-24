import { createHmac, timingSafeEqual } from 'crypto';
import type { IDataObject, IHookFunctions, JsonObject, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { EVENT_OPTIONS } from '../shared/events';
import { postkeyRequest, simplify } from '../shared/transport';

/** A delivery's timestamp may be at most this far from the clock (Standard Webhooks). */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Does this delivery carry a Standard Webhooks signature made with the endpoint's secret? `signature` may hold two,
 * space-separated, while a new secret is being rolled in: either one is enough.
 */
export function signatureValid(secret: string, id: string, timestamp: string, signature: string, rawBody: string, nowSeconds: number): boolean {
	const ts = Number(timestamp);
	if (!id || !Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
	const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
	const want = Buffer.from(`v1,${createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64')}`);
	return signature.split(' ').some((part) => {
		const got = Buffer.from(part);
		return got.length === want.length && timingSafeEqual(got, want);
	});
}

export class PostkeyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Postkey Trigger',
		name: 'postkeyTrigger',
		icon: { light: 'file:../../icons/postkey.svg', dark: 'file:../../icons/postkey.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in Postkey: a comment, a DM, a new contact, a post published, an approval',
		defaults: {
			name: 'Postkey Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'postkeyApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Postkey sends each event to this workflow’s address. The address must be reachable from the internet over HTTPS (n8n Cloud, or a self-hosted n8n with a public address). The agent key needs the Webhooks access, and webhooks come with a paid Postkey plan.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENT_OPTIONS,
				default: ['comment.received'],
				required: true,
				description: 'The events that start the workflow',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: false,
				description:
					'Whether to turn text people wrote ({ untrusted, text }) into plain strings. Leave off when an AI agent reads the output, so it treats that text as data.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (typeof data.endpointId !== 'string') return false;
				try {
					const found = await postkeyRequest(this, 'GET', `/webhook-endpoints/${data.endpointId}`);
					const events = [...(this.getNodeParameter('events', []) as string[])].sort().join(',');
					const same = found.body.url === this.getNodeWebhookUrl('default') && [...((found.body.events as string[]) ?? [])].sort().join(',') === events;
					if (same && found.body.status !== 'disabled') return true;
					await postkeyRequest(this, 'DELETE', `/webhook-endpoints/${data.endpointId}`);
				} catch (error) {
					if (!(error instanceof NodeApiError) || error.httpCode !== '404') throw error instanceof NodeApiError ? error : new NodeApiError(this.getNode(), error as JsonObject);
				}
				delete data.endpointId;
				delete data.secret;
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const made = await postkeyRequest(this, 'POST', '/webhook-endpoints', {
					body: {
						url: this.getNodeWebhookUrl('default') as string,
						events: this.getNodeParameter('events', []) as string[],
						description: `n8n: ${this.getWorkflow().name ?? 'workflow'}`.slice(0, 200),
					},
				});
				if (typeof made.body.id !== 'string' || typeof made.body.secret !== 'string') return false;
				data.endpointId = made.body.id;
				data.secret = made.body.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (typeof data.endpointId === 'string') {
					try {
						await postkeyRequest(this, 'DELETE', `/webhook-endpoints/${data.endpointId}`);
					} catch (error) {
						if (!(error instanceof NodeApiError) || error.httpCode !== '404') return false;
					}
				}
				delete data.endpointId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const data = this.getWorkflowStaticData('node');
		const headers = this.getHeaderData() as IDataObject;
		const request = this.getRequestObject() as unknown as { rawBody?: Buffer };
		const raw = request.rawBody ? request.rawBody.toString('utf8') : JSON.stringify(this.getBodyData());
		const ok =
			typeof data.secret === 'string' &&
			signatureValid(data.secret, String(headers['webhook-id'] ?? ''), String(headers['webhook-timestamp'] ?? ''), String(headers['webhook-signature'] ?? ''), raw, Math.floor(Date.now() / 1000));
		if (!ok) {
			const response = this.getResponseObject();
			response.status(401).send('The signature did not match.').end();
			return { noWebhookResponse: true };
		}
		const event = this.getBodyData();
		const out = this.getNodeParameter('simplify', false) ? (simplify(event) as IDataObject) : event;
		return { workflowData: [this.helpers.returnJsonArray(out)] };
	}
}
