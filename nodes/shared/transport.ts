import { createHash } from 'crypto';
import type { IDataObject, IExecuteFunctions, IHookFunctions, IHttpRequestMethods, IHttpRequestOptions, ILoadOptionsFunctions, IWebhookFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

/** What Postkey answered: the HTTP status and the JSON body. */
export type PostkeyAnswer = { status: number; body: IDataObject };

const CREDENTIAL = 'postkeyApi';

/** The REST API's address from the credential (https://postkey.pro unless Postkey gave another). */
export async function apiBase(ctx: Context): Promise<string> {
	const credentials = await ctx.getCredentials(CREDENTIAL);
	const base = typeof credentials.baseUrl === 'string' && credentials.baseUrl.trim() ? credentials.baseUrl.trim() : 'https://postkey.pro';
	return `${base.replace(/\/+$/, '')}/api/v1`;
}

/**
 * One call to the Postkey REST API with the agent key. A 2xx answer comes back (202 "waiting for approval" is not an
 * error: nothing was sent, a person approves it in Postkey). Anything else is thrown as a NodeApiError with Postkey's
 * own code and sentence. `idempotencyKey`: sent on writes, so a retried item never does the same thing twice.
 */
export async function postkeyRequest(ctx: Context, method: IHttpRequestMethods, path: string, opts: { body?: IDataObject; qs?: IDataObject; idempotencyKey?: string; itemIndex?: number } = {}): Promise<PostkeyAnswer> {
	const options: IHttpRequestOptions = {
		method,
		url: `${await apiBase(ctx)}${path}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		headers: { accept: 'application/json', ...(opts.idempotencyKey ? { 'idempotency-key': opts.idempotencyKey } : {}) },
		...(opts.body ? { body: opts.body } : {}),
		...(opts.qs ? { qs: opts.qs } : {}),
	};
	const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, options)) as { statusCode: number; body: unknown };
	const body = (response.body && typeof response.body === 'object' ? response.body : {}) as IDataObject;
	if (response.statusCode >= 200 && response.statusCode < 300) return { status: response.statusCode, body };
	const error = (body.error ?? {}) as IDataObject;
	const code = typeof error.code === 'string' ? error.code : `http_${response.statusCode}`;
	const message = typeof error.message === 'string' ? error.message : `Postkey answered HTTP ${response.statusCode}.`;
	throw new NodeApiError(ctx.getNode(), body as JsonObject, {
		message,
		description: `Postkey code: ${code}${typeof error.request_id === 'string' ? ` (request ${error.request_id})` : ''}`,
		httpCode: String(response.statusCode),
		...(opts.itemIndex !== undefined ? { itemIndex: opts.itemIndex } : {}),
	});
}

/** Every page of a list (GET with next_cursor), up to `max` items. */
export async function allPages(ctx: Context, path: string, qs: IDataObject, max = Infinity): Promise<IDataObject[]> {
	const out: IDataObject[] = [];
	let cursor: string | null = null;
	do {
		const page = await postkeyRequest(ctx, 'GET', path, { qs: { ...qs, ...(cursor ? { cursor } : {}) } });
		const data = Array.isArray(page.body.data) ? (page.body.data as IDataObject[]) : [];
		out.push(...data);
		cursor = page.body.has_more === true && typeof page.body.next_cursor === 'string' ? page.body.next_cursor : null;
	} while (cursor && out.length < max);
	return out.slice(0, max);
}

/**
 * The same Idempotency-Key for the same item of the same run of the same node (1 to 100 printable characters): when
 * n8n retries the item, Postkey answers the first answer again and does nothing twice.
 */
export function idempotencyKeyFor(ctx: IExecuteFunctions, itemIndex: number, operation: string): string {
	const seed = `${ctx.getExecutionId() ?? 'manual'}|${ctx.getNode().id}|${itemIndex}|${operation}`;
	return `n8n-${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;
}

/**
 * "Simplify": text written by people outside the profile comes from Postkey as { untrusted: true, text } so an AI agent
 * treats it as data. Simplified, it is the plain string. Off by default: keep it on when an AI agent reads the output.
 */
export function simplify(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(simplify);
	if (value && typeof value === 'object') {
		const o = value as IDataObject;
		if (typeof o.untrusted === 'boolean' && typeof o.text === 'string' && Object.keys(o).every((k) => k === 'untrusted' || k === 'text' || k === 'truncated')) return o.text;
		return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, simplify(v)]));
	}
	return value;
}
