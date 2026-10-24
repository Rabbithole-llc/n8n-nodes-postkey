// A small stand-in for n8n's node contexts: enough of IExecuteFunctions, IHookFunctions and IWebhookFunctions for the
// nodes in this package, with real HTTP (fetch) to a Postkey server. Not a test file itself.

type Params = Record<string, unknown>;
type Answer = { statusCode: number; body: unknown };

export type World = { base: string; key: string; staticData: Record<string, unknown>; executionId: string; webhookUrl: string };

async function http(options: { method?: string; url: string; body?: unknown; qs?: Record<string, unknown>; headers?: Record<string, string> }, auth: string | null): Promise<Answer> {
	const url = new URL(options.url);
	for (const [k, v] of Object.entries(options.qs ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
	const raw = options.body instanceof Uint8Array;
	const res = await fetch(url, {
		method: options.method ?? 'GET',
		headers: { ...(options.headers ?? {}), ...(auth ? { authorization: auth } : {}), ...(options.body !== undefined && !raw ? { 'content-type': 'application/json' } : {}) },
		body: options.body === undefined ? undefined : raw ? (options.body as Uint8Array) : JSON.stringify(options.body),
	});
	const text = await res.text();
	let body: unknown = text;
	try {
		body = JSON.parse(text);
	} catch {
		/* not JSON */
	}
	return { statusCode: res.status, body };
}

function base(world: World, params: Params) {
	const node = { id: 'node-1', name: 'Postkey', type: 'n8n-nodes-postkey.postkey', typeVersion: 1, position: [0, 0], parameters: {} };
	return {
		getNode: () => node,
		getCredentials: async () => ({ apiKey: world.key, baseUrl: world.base }),
		getWorkflowStaticData: () => world.staticData,
		getWorkflow: () => ({ id: 'wf-1', name: 'Test workflow', active: true }),
		getExecutionId: () => world.executionId,
		continueOnFail: () => false,
		getNodeWebhookUrl: () => world.webhookUrl,
		getNodeParameter: (name: string, a?: unknown, b?: unknown) => {
			const fallback = typeof a === 'number' ? b : a;
			return Object.hasOwn(params, name) ? params[name] : fallback;
		},
		helpers: {
			httpRequestWithAuthentication: async (_cred: string, options: Parameters<typeof http>[0]) => http(options, `Bearer ${world.key}`),
			httpRequest: async (options: Parameters<typeof http>[0]) => (await http(options, null)).body,
			returnJsonArray: (v: unknown) => (Array.isArray(v) ? v : [v]).map((json) => ({ json })),
			assertBinaryData: (_i: number, field: string) => (params.__binary as Record<string, { fileName: string; mimeType: string; data: Buffer }>)[field],
			getBinaryDataBuffer: async (_i: number, field: string) => (params.__binary as Record<string, { data: Buffer }>)[field].data,
		},
	};
}

/** IExecuteFunctions for one input item with these parameters. */
export function executeContext(world: World, params: Params) {
	return withCall({ ...base(world, params), getInputData: () => [{ json: {} }] });
}

export function hookContext(world: World, params: Params) {
	return withCall(base(world, params));
}

/** IWebhookFunctions for one delivery as it arrived. */
export function webhookContext(world: World, params: Params, delivery: { headers: Record<string, string>; body: string }) {
	let status = 200;
	let sent = '';
	const response = { status: (s: number) => ((status = s), response), send: (t: string) => ((sent = t), response), end: () => response };
	const ctx = {
		...base(world, params),
		getHeaderData: () => delivery.headers,
		getRequestObject: () => ({ rawBody: Buffer.from(delivery.body) }),
		getBodyData: () => JSON.parse(delivery.body),
		getResponseObject: () => response,
	};
	return { ctx: withCall(ctx), response: () => ({ status, sent }) };
}

/** n8n calls `helpers.httpRequestWithAuthentication.call(this, ...)`: a plain function with call() does the same. */
function withCall<T extends { helpers: { httpRequestWithAuthentication: (...a: never[]) => unknown } }>(ctx: T): T {
	const fn = ctx.helpers.httpRequestWithAuthentication;
	ctx.helpers.httpRequestWithAuthentication = Object.assign((...a: never[]) => fn(...a), { call: (_this: unknown, ...a: never[]) => fn(...a) }) as never;
	return ctx;
}
