import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { allPages, idempotencyKeyFor, postkeyRequest, simplify } from '../shared/transport';
import { fieldProperties, operationProperties, resourceProperty } from './descriptions';

// PROGRAMMATIC, not declarative: every write needs an Idempotency-Key that stays the same when n8n retries the item;
// an upload is three dependent calls (the place, the bytes, the finish); "Return All" follows Postkey's cursors; a 202
// "waiting for approval" is an answer, not an error; and "Simplify" reshapes untrusted text in any answer.

const list = (v: unknown): string[] =>
	String(v ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

/** Collection fields as the API's body: empty strings left out, comma lists as arrays. */
function bodyOf(fields: IDataObject, lists: string[] = []): IDataObject {
	const out: IDataObject = {};
	for (const [k, v] of Object.entries(fields)) {
		if (v === '' || v === undefined || v === null) continue;
		out[k] = lists.includes(k) ? list(v) : v;
	}
	return out;
}

function kindOf(mime: string | undefined): 'image' | 'video' | 'audio' | 'file' {
	const m = (mime ?? '').toLowerCase();
	return m.startsWith('image/') ? 'image' : m.startsWith('video/') ? 'video' : m.startsWith('audio/') ? 'audio' : 'file';
}

const enc = encodeURIComponent;

export class Postkey implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Postkey',
		name: 'postkey',
		icon: { light: 'file:../../icons/postkey.svg', dark: 'file:../../icons/postkey.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Schedule posts, run Instagram DM automations, tag contacts and reply in the Inbox with Postkey',
		defaults: {
			name: 'Postkey',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'postkeyApi',
				required: true,
			},
		],
		properties: [resourceProperty, ...operationProperties, ...fieldProperties],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const write = (method: IHttpRequestMethods, path: string, body?: IDataObject) => postkeyRequest(this, method, path, { body, idempotencyKey: idempotencyKeyFor(this, i, `${resource}.${operation}`), itemIndex: i });
				const read = (path: string, qs?: IDataObject) => postkeyRequest(this, 'GET', path, { qs, itemIndex: i });
				const many = async (path: string, qs: IDataObject = {}) => {
					const all = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = all ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
					return allPages(this, path, qs, limit);
				};
				let result: IDataObject | IDataObject[];

				if (resource === 'profile') result = (await read('/me')).body;
				else if (resource === 'socialAccount') result = await allPages(this, '/social-accounts', {});
				else if (resource === 'post') {
					const postId = () => enc(this.getNodeParameter('postId', i) as string);
					if (operation === 'create') result = (await write('POST', '/posts', { type: this.getNodeParameter('postType', i) as string, ...bodyOf(this.getNodeParameter('postFields', i, {}) as IDataObject, ['media_ids', 'social_account_ids']) })).body;
					else if (operation === 'get') result = (await read(`/posts/${postId()}`)).body;
					else if (operation === 'getAll') result = await many('/posts');
					else if (operation === 'update') result = (await write('PATCH', `/posts/${postId()}`, bodyOf(this.getNodeParameter('postFields', i, {}) as IDataObject, ['media_ids', 'social_account_ids']))).body;
					else if (operation === 'delete') result = (await write('DELETE', `/posts/${postId()}`)).body;
					else if (operation === 'schedule') {
						const when = this.getNodeParameter('when', i) as string;
						const at = when === 'at' ? new Date(this.getNodeParameter('at', i) as string).toISOString() : undefined;
						result = (await write('POST', `/posts/${postId()}/schedule`, { when, ...(at ? { at } : {}) })).body;
					} else result = (await write('POST', `/posts/${postId()}/unschedule`)).body;
				} else if (resource === 'media') {
					if (operation === 'getAll') result = await many('/media');
					else {
						const field = this.getNodeParameter('binaryPropertyName', i) as string;
						const binary = this.helpers.assertBinaryData(i, field);
						const bytes = await this.helpers.getBinaryDataBuffer(i, field);
						const name = binary.fileName ?? `upload.${binary.fileExtension ?? 'bin'}`;
						const place = (await write('POST', '/uploads', { name, size: bytes.length, ...(binary.mimeType ? { type: binary.mimeType } : {}) })).body;
						if (typeof place.upload_url === 'string') {
							await this.helpers.httpRequest({ method: 'PUT', url: place.upload_url, body: bytes, headers: { ...((place.headers as IDataObject) ?? {}), ...(binary.mimeType ? { 'content-type': binary.mimeType } : {}) } });
						}
						const title = (this.getNodeParameter('mediaTitle', i, '') as string) || name;
						result = (await postkeyRequest(this, 'POST', `/uploads/${enc(String(place.upload_id))}/complete`, { body: { title, kind: kindOf(binary.mimeType) }, idempotencyKey: idempotencyKeyFor(this, i, 'media.complete'), itemIndex: i })).body;
					}
				} else if (resource === 'automation') {
					const automationId = () => enc(this.getNodeParameter('automationId', i) as string);
					if (operation === 'create') result = (await write('POST', '/automations', { template_key: this.getNodeParameter('templateKey', i) as string, ...bodyOf(this.getNodeParameter('automationFields', i, {}) as IDataObject, ['social_account_ids']) })).body;
					else if (operation === 'get') result = (await read(`/automations/${automationId()}`)).body;
					else if (operation === 'getAll') result = await many('/automations');
					else if (operation === 'getTemplates') result = await allPages(this, '/automation-templates', {});
					else if (operation === 'update') result = (await write('PATCH', `/automations/${automationId()}`, bodyOf(this.getNodeParameter('automationUpdate', i, {}) as IDataObject, ['keywords']))).body;
					else if (operation === 'publish') result = (await write('POST', `/automations/${automationId()}/publish`)).body;
					else result = (await write('POST', `/automations/${automationId()}/pause`)).body;
				} else if (resource === 'contact') {
					if (operation === 'get') result = (await read(`/contacts/${enc(this.getNodeParameter('contactId', i) as string)}`)).body;
					else if (operation === 'getAll') result = await many('/contacts', bodyOf(this.getNodeParameter('contactFilters', i, {}) as IDataObject));
					else {
						const add = list(this.getNodeParameter('addTags', i, ''));
						const remove = list(this.getNodeParameter('removeTags', i, ''));
						if (!add.length && !remove.length) throw new NodeOperationError(this.getNode(), 'Give at least one tag to add or remove.', { itemIndex: i });
						result = (await write('POST', `/contacts/${enc(this.getNodeParameter('contactId', i) as string)}/tags`, { ...(add.length ? { add } : {}), ...(remove.length ? { remove } : {}) })).body;
					}
				} else if (resource === 'conversation') {
					if (operation === 'get') result = (await read(`/conversations/${enc(this.getNodeParameter('conversationId', i) as string)}`)).body;
					else if (operation === 'getAll') result = await many('/conversations', bodyOf(this.getNodeParameter('conversationFilters', i, {}) as IDataObject));
					else result = (await write('POST', `/conversations/${enc(this.getNodeParameter('conversationId', i) as string)}/messages`, { text: this.getNodeParameter('text', i) as string, close: this.getNodeParameter('close', i, false) as boolean })).body;
				} else if (resource === 'approval') {
					result = operation === 'get' ? (await read(`/approvals/${enc(this.getNodeParameter('approvalId', i) as string)}`)).body : await allPages(this, '/approvals', {});
				} else {
					const filters = this.getNodeParameter('eventFilters', i, {}) as IDataObject;
					const qs = bodyOf(filters);
					if (typeof qs.since === 'string') qs.since = new Date(qs.since).toISOString();
					result = await many('/events', qs);
				}

				const shaped = this.getNodeParameter('simplify', i, false) ? simplify(result) : result;
				for (const json of Array.isArray(shaped) ? (shaped as IDataObject[]) : [shaped as IDataObject]) out.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError ? error : new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
