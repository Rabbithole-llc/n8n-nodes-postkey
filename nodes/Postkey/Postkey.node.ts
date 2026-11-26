import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, ILoadOptionsFunctions, INodeExecutionData, INodeListSearchResult, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
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

/** Text people outside the profile wrote comes as { untrusted, text }: the text of it, for a label. */
const plain = (v: unknown): string => (v && typeof v === 'object' ? String((v as IDataObject).text ?? '') : typeof v === 'string' ? v : '');

const short = (s: string, max = 70): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * A "From List" picker: one page of a list per call (n8n asks for the next with the cursor), each row named by
 * `label`. `searchParam`: the list's own search, where it has one; otherwise what is typed filters the page.
 */
function picker(path: string, label: (row: IDataObject) => string, opts: { searchParam?: string; qs?: IDataObject; listKey?: string } = {}) {
	return async function (this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const qs: IDataObject = { ...(opts.qs ?? {}), ...(paginationToken ? { cursor: paginationToken } : {}), ...(filter && opts.searchParam ? { [opts.searchParam]: filter } : {}) };
		const page = (await postkeyRequest(this, 'GET', path, { qs })).body;
		const rows = (Array.isArray(page[opts.listKey ?? 'data']) ? page[opts.listKey ?? 'data'] : []) as IDataObject[];
		const wanted = filter && !opts.searchParam ? filter.toLowerCase() : '';
		const results = rows
			.map((row) => ({ name: short(label(row).trim() || String(row.id)), value: String(row.id) }))
			.filter((r) => !wanted || r.name.toLowerCase().includes(wanted));
		const next = page.has_more === true && typeof page.next_cursor === 'string' ? page.next_cursor : undefined;
		return { results, ...(next ? { paginationToken: next } : {}) };
	};
}

/** A dropdown's options from a whole (short) list. */
function options(path: string, row: (r: IDataObject) => INodePropertyOptions, listKey = 'data') {
	return async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		if (listKey !== 'data') {
			const body = (await postkeyRequest(this, 'GET', path)).body;
			return (Array.isArray(body[listKey]) ? (body[listKey] as IDataObject[]) : []).map(row);
		}
		return (await allPages(this, path, {})).map(row);
	};
}

function jsonOf(ctx: IExecuteFunctions, value: unknown, name: string, itemIndex: number): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(ctx.getNode(), `'${name}' is not valid JSON`, { description: `Check the brackets, quotes and commas in '${name}'.`, itemIndex });
	}
}

export class Postkey implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Postkey',
		name: 'postkey',
		icon: { light: 'file:../../icons/postkey.svg', dark: 'file:../../icons/postkey.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Schedule posts, run DM automations, edit videos, tag contacts and reply in the Inbox with Postkey',
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

	methods = {
		loadOptions: {
			getSocialAccounts: options('/social-accounts', (a) => ({ name: `${String(a.handle ?? a.name ?? a.id)} (${String(a.network)})`, value: String(a.id) })),
			getAutomationTemplates: options('/automation-templates', (t) => ({ name: String(t.name ?? t.key), value: String(t.key), description: String(t.does ?? '') })),
			getEditFormats: options('/edit-templates', (f) => ({ name: String(f.name ?? f.id), value: String(f.id), description: String(f.blurb ?? '') }), 'formats'),
		},
		listSearch: {
			searchApprovals: picker('/approvals', (a) => `${String(a.title ?? a.kind ?? '')} (${String(a.status ?? '')})`),
			searchAutomations: picker('/automations', (a) => `${String(a.name ?? '')} (${String(a.status ?? '')})`, { searchParam: 'search' }),
			searchContacts: picker('/contacts', (c) => [plain(c.name), plain(c.handle) && `@${plain(c.handle)}`].filter(Boolean).join(' '), { searchParam: 'search' }),
			searchConversations: picker('/conversations', (c) => `${plain(c.name) || plain(c.handle)} (${String(c.channel ?? '')})`, { qs: { state: 'all' } }),
			searchEdits: picker('/edits', (e) => String(e.title ?? '')),
			searchEditTemplates: picker('/edit-templates', (t) => String(t.name ?? ''), { listKey: 'saved' }),
			searchPosts: picker('/posts', (p) => `${String(p.title ?? '') || String(p.caption ?? '')} (${String(p.status ?? '')})`),
			searchVideos: picker('/media', (m) => String(m.title ?? ''), { searchParam: 'search', qs: { kind: 'video' } }),
		},
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
				const idOf = (name: string) => enc(this.getNodeParameter(name, i, '', { extractValue: true }) as string);
				let result: IDataObject | IDataObject[];

				if (resource === 'profile') result = (await read('/me')).body;
				else if (resource === 'socialAccount') result = await allPages(this, '/social-accounts', {});
				else if (resource === 'post') {
					const postId = () => idOf('postId');
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
					const automationId = () => idOf('automationId');
					if (operation === 'create') result = (await write('POST', '/automations', { template_key: this.getNodeParameter('templateKey', i) as string, ...bodyOf(this.getNodeParameter('automationFields', i, {}) as IDataObject, ['social_account_ids']) })).body;
					else if (operation === 'get') result = (await read(`/automations/${automationId()}`)).body;
					else if (operation === 'getAll') result = await many('/automations');
					else if (operation === 'getTemplates') result = await allPages(this, '/automation-templates', {});
					else if (operation === 'update') result = (await write('PATCH', `/automations/${automationId()}`, bodyOf(this.getNodeParameter('automationUpdate', i, {}) as IDataObject, ['keywords']))).body;
					else if (operation === 'publish') result = (await write('POST', `/automations/${automationId()}/publish`)).body;
					else result = (await write('POST', `/automations/${automationId()}/pause`)).body;
				} else if (resource === 'contact') {
					if (operation === 'get') result = (await read(`/contacts/${idOf('contactId')}`)).body;
					else if (operation === 'getAll') result = await many('/contacts', bodyOf(this.getNodeParameter('contactFilters', i, {}) as IDataObject));
					else {
						const add = list(this.getNodeParameter('addTags', i, ''));
						const remove = list(this.getNodeParameter('removeTags', i, ''));
						if (!add.length && !remove.length) throw new NodeOperationError(this.getNode(), "'Add Tags' and 'Remove Tags' are both empty", { description: "Give at least one tag in 'Add Tags' or 'Remove Tags'.", itemIndex: i });
						result = (await write('POST', `/contacts/${idOf('contactId')}/tags`, { ...(add.length ? { add } : {}), ...(remove.length ? { remove } : {}) })).body;
					}
				} else if (resource === 'conversation') {
					if (operation === 'get') result = (await read(`/conversations/${idOf('conversationId')}`)).body;
					else if (operation === 'getAll') result = await many('/conversations', bodyOf(this.getNodeParameter('conversationFilters', i, {}) as IDataObject));
					else result = (await write('POST', `/conversations/${idOf('conversationId')}/messages`, { text: this.getNodeParameter('text', i) as string, close: this.getNodeParameter('close', i, false) as boolean })).body;
				} else if (resource === 'approval') {
					result = operation === 'get' ? (await read(`/approvals/${idOf('approvalId')}`)).body : await allPages(this, '/approvals', {});
				} else if (resource === 'videoEdit') {
					if (operation === 'getAll') result = await many('/edits');
					else if (operation === 'get') result = (await read(`/edits/${idOf('editId')}`, bodyOf(this.getNodeParameter('editGetOptions', i, {}) as IDataObject))).body;
					else if (operation === 'create') {
						const fields = { ...(this.getNodeParameter('editFields', i, {}) as IDataObject) };
						// A picker inside a collection arrives as { mode, value }: the API takes the ID.
						if (fields.template && typeof fields.template === 'object') fields.template = (fields.template as IDataObject).value;
						if (Array.isArray(fields.roles) && !fields.roles.length) delete fields.roles;
						result = (await write('POST', '/edits', bodyOf(fields, ['media_ids', 'words']))).body;
					} else if (operation === 'cloneStyle') result = (await write('POST', '/edits', { clone: this.getNodeParameter('cloneName', i) as string, media_ids: [decodeURIComponent(idOf('cloneMediaId'))] })).body;
					else if (operation === 'createShorts') {
						const clips = (((this.getNodeParameter('clips', i, {}) as IDataObject).clip as IDataObject[]) ?? []).map((c) => bodyOf(c));
						if (!clips.length) throw new NodeOperationError(this.getNode(), "'Clips' is empty", { description: "Add at least one clip with its first and last sentence ID from Video Edit: Get.", itemIndex: i });
						result = (await write('POST', '/edits', { from_edit: decodeURIComponent(idOf('sourceEditId')), clips, ...(this.getNodeParameter('anyLength', i, false) ? { any_length: true } : {}) })).body;
					} else if (operation === 'update') {
						const ops = jsonOf(this, this.getNodeParameter('changes', i), 'Changes', i);
						if (!Array.isArray(ops) || !ops.length) throw new NodeOperationError(this.getNode(), "'Changes' has no changes", { description: "Give 'Changes' a JSON list with at least one object that has an op.", itemIndex: i });
						const note = this.getNodeParameter('changeNote', i, '') as string;
						result = (await write('POST', `/edits/${idOf('editId')}/changes`, { ops, ...(note ? { note } : {}) })).body;
					} else result = (await write('POST', `/edits/${idOf('editId')}/undo`, { change_id: this.getNodeParameter('changeId', i) as string })).body;
				} else if (resource === 'videoEditTemplate') {
					if (operation === 'getAll' || operation === 'getFormats') {
						const body = (await read('/edit-templates')).body;
						const rows = ((operation === 'getAll' ? body.saved : body.formats) ?? []) as IDataObject[];
						result = this.getNodeParameter('returnAll', i, true) ? rows : rows.slice(0, this.getNodeParameter('limit', i, 50) as number);
					} else if (operation === 'get') result = (await read('/edit-templates', { template: decodeURIComponent(idOf('templateId')) })).body;
					else if (operation === 'create') result = (await write('POST', '/edit-templates', { edit_id: decodeURIComponent(idOf('templateEditId')), name: this.getNodeParameter('templateName', i) as string })).body;
					else {
						const fields = bodyOf(this.getNodeParameter('templateUpdate', i, {}) as IDataObject);
						if (fields.look !== undefined) {
							const look = jsonOf(this, fields.look, 'Look', i) as IDataObject;
							if (look && typeof look === 'object' && Object.keys(look).length) fields.look = look;
							else delete fields.look;
						}
						if (!Object.keys(fields).length) throw new NodeOperationError(this.getNode(), "'Update Fields' is empty", { description: "Add at least one field to 'Update Fields'.", itemIndex: i });
						result = (await write('POST', '/edit-templates', { template_id: decodeURIComponent(idOf('templateId')), ...fields })).body;
					}
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
