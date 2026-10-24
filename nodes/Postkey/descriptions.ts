import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });

const id = (name: string, displayName: string, resource: string, operation: string[], description: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	required: true,
	default: '',
	displayOptions: show(resource, operation),
	description,
});

const returnAll = (resource: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: show(resource, ['getAll']),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: [resource], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
];

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Approval', value: 'approval' },
		{ name: 'Automation', value: 'automation' },
		{ name: 'Contact', value: 'contact' },
		{ name: 'Conversation', value: 'conversation' },
		{ name: 'Event', value: 'event' },
		{ name: 'Media', value: 'media' },
		{ name: 'Post', value: 'post' },
		{ name: 'Profile', value: 'profile' },
		{ name: 'Social Account', value: 'socialAccount' },
	],
	default: 'post',
};

const operations = (resource: string, options: { name: string; value: string; action: string; description: string }[], def: string): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options,
	default: def,
});

export const operationProperties: INodeProperties[] = [
	operations('approval', [
		{ name: 'Get', value: 'get', action: 'Get an approval', description: 'What became of a request this key made that waited for a person' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many approvals', description: 'What waits for a person in Postkey' },
	], 'get'),
	operations('automation', [
		{ name: 'Create', value: 'create', action: 'Create an automation', description: 'Make a draft DM automation from a template (it is not switched on)' },
		{ name: 'Get', value: 'get', action: 'Get an automation', description: 'One automation' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many automations', description: 'The profile’s DM automations' },
		{ name: 'Get Templates', value: 'getTemplates', action: 'Get automation templates', description: 'The templates an automation can be made from' },
		{ name: 'Pause', value: 'pause', action: 'Pause an automation', description: 'Switch a live automation off' },
		{ name: 'Publish', value: 'publish', action: 'Publish an automation', description: 'Set it live (waits for a person when the key asks first)' },
		{ name: 'Update', value: 'update', action: 'Update an automation', description: 'Change its draft' },
	], 'getAll'),
	operations('contact', [
		{ name: 'Get', value: 'get', action: 'Get a contact', description: 'One contact' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many contacts', description: 'Find contacts' },
		{ name: 'Tag', value: 'tag', action: 'Tag a contact', description: 'Add or remove existing tags' },
	], 'getAll'),
	operations('conversation', [
		{ name: 'Get', value: 'get', action: 'Get a conversation', description: 'One conversation and its messages' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many conversations', description: 'The Inbox' },
		{ name: 'Reply', value: 'reply', action: 'Reply in a conversation', description: 'Send a reply (waits for a person when the key asks first)' },
	], 'getAll'),
	operations('event', [{ name: 'Get Many', value: 'getAll', action: 'Get many events', description: 'Postkey’s event log of the last 30 days, newest first' }], 'getAll'),
	operations('media', [
		{ name: 'Get Many', value: 'getAll', action: 'Get many media', description: 'The media library' },
		{ name: 'Upload', value: 'upload', action: 'Upload media', description: 'Add a file from the input to the media library' },
	], 'upload'),
	operations('post', [
		{ name: 'Create', value: 'create', action: 'Create a post', description: 'Make a draft post' },
		{ name: 'Delete', value: 'delete', action: 'Delete a post', description: 'Delete a draft' },
		{ name: 'Get', value: 'get', action: 'Get a post', description: 'One post' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many posts', description: 'The profile’s posts' },
		{ name: 'Schedule', value: 'schedule', action: 'Schedule a post', description: 'Publish now, at a time, or in the queue (waits for a person when the key asks first)' },
		{ name: 'Unschedule', value: 'unschedule', action: 'Unschedule a post', description: 'Make it a draft again' },
		{ name: 'Update', value: 'update', action: 'Update a post', description: 'Change a draft' },
	], 'create'),
	operations('profile', [{ name: 'Get', value: 'get', action: 'Get the profile', description: 'The profile, this key and its limits' }], 'get'),
	operations('socialAccount', [{ name: 'Get Many', value: 'getAll', action: 'Get many social accounts', description: 'The connected social accounts' }], 'getAll'),
];

const postFields = (operation: string[]): INodeProperties => ({
	displayName: operation[0] === 'create' ? 'Additional Fields' : 'Update Fields',
	name: 'postFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: show('post', operation),
	options: [
		{ displayName: 'Caption', name: 'caption', type: 'string', typeOptions: { rows: 4 }, default: '', description: 'What is published with the post' },
		{ displayName: 'Keyword', name: 'keyword', type: 'string', default: '', description: 'The word people comment to get a DM (a live automation with the same keyword sends it)' },
		{ displayName: 'Link URL', name: 'link_url', type: 'string', default: '', description: 'The link the keyword automation hands out' },
		{ displayName: 'Media IDs', name: 'media_ids', type: 'string', default: '', description: 'Media library IDs in order, comma-separated (from Media: Upload or Get Many)' },
		{ displayName: 'Social Account IDs', name: 'social_account_ids', type: 'string', default: '', description: 'Where it goes, comma-separated (from Social Account: Get Many)' },
		{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'An internal title only the team sees' },
	],
});

export const fieldProperties: INodeProperties[] = [
	// ---- approval
	id('approvalId', 'Approval ID', 'approval', ['get'], 'The approval_id a held call answered with'),
	// ---- automation
	id('automationId', 'Automation ID', 'automation', ['get', 'update', 'publish', 'pause'], 'The automation’s ID'),
	id('templateKey', 'Template Key', 'automation', ['create'], 'The template’s key (Automation: Get Templates)'),
	{
		displayName: 'Additional Fields',
		name: 'automationFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('automation', ['create']),
		options: [
			{ displayName: 'Followers Only', name: 'followers_only', type: 'boolean', default: false, description: 'Whether only followers get the link (Instagram)' },
			{ displayName: 'Keyword', name: 'keyword', type: 'string', default: '', description: 'The word that starts it, when the template needs one' },
			{ displayName: 'Link URL', name: 'link_url', type: 'string', default: '', description: 'The link it hands out, when the template needs one' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'A name for it' },
			{ displayName: 'Social Account IDs', name: 'social_account_ids', type: 'string', default: '', description: 'The accounts it runs on, comma-separated' },
		],
	},
	{
		displayName: 'Update Fields',
		name: 'automationUpdate',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('automation', ['update']),
		options: [
			{ displayName: 'Followers Only', name: 'followers_only', type: 'boolean', default: false, description: 'Whether only followers get the link' },
			{ displayName: 'Keywords', name: 'keywords', type: 'string', default: '', description: 'The words that start it, comma-separated' },
			{ displayName: 'Link Message', name: 'link_message', type: 'string', default: '', description: 'The message with the link' },
			{ displayName: 'Link URL', name: 'link_url', type: 'string', default: '', description: 'The link it hands out' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Its name' },
			{ displayName: 'Opening Message', name: 'opening_message', type: 'string', default: '', description: 'The first message' },
		],
	},
	...returnAll('automation'),
	// ---- contact
	id('contactId', 'Contact ID', 'contact', ['get', 'tag'], 'The contact’s ID'),
	{ displayName: 'Add Tags', name: 'addTags', type: 'string', default: '', displayOptions: show('contact', ['tag']), description: 'Existing tags to add, comma-separated' },
	{ displayName: 'Remove Tags', name: 'removeTags', type: 'string', default: '', displayOptions: show('contact', ['tag']), description: 'Tags to remove, comma-separated' },
	{
		displayName: 'Filters',
		name: 'contactFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('contact', ['getAll']),
		options: [
			{ displayName: 'Search', name: 'search', type: 'string', default: '', description: 'A name or a handle' },
			{ displayName: 'Tag', name: 'tag', type: 'string', default: '', description: 'Only contacts with this tag' },
		],
	},
	...returnAll('contact'),
	// ---- conversation
	id('conversationId', 'Conversation ID', 'conversation', ['get', 'reply'], 'The conversation’s ID'),
	{ displayName: 'Text', name: 'text', type: 'string', typeOptions: { rows: 3 }, required: true, default: '', displayOptions: show('conversation', ['reply']), description: 'The reply, at most 1,000 characters' },
	{ displayName: 'Close After', name: 'close', type: 'boolean', default: false, displayOptions: show('conversation', ['reply']), description: 'Whether to close the conversation after the reply' },
	{
		displayName: 'Filters',
		name: 'conversationFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('conversation', ['getAll']),
		options: [
			{ displayName: 'State', name: 'state', type: 'options', options: [{ name: 'All', value: 'all' }, { name: 'Closed', value: 'closed' }, { name: 'Open', value: 'open' }], default: 'open', description: 'Which conversations' },
			{ displayName: 'Unread Only', name: 'unread_only', type: 'boolean', default: false, description: 'Whether to list only unread conversations' },
		],
	},
	...returnAll('conversation'),
	// ---- event
	{
		displayName: 'Filters',
		name: 'eventFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('event', ['getAll']),
		options: [
			{ displayName: 'Since', name: 'since', type: 'dateTime', default: '', description: 'Only events made at or after this time' },
			{ displayName: 'Type', name: 'type', type: 'string', default: '', description: 'Only events of this type, for example comment.received' },
		],
	},
	...returnAll('event'),
	// ---- media
	{ displayName: 'Input Binary Field', name: 'binaryPropertyName', type: 'string', default: 'data', required: true, displayOptions: show('media', ['upload']), description: 'The input field that holds the file' },
	{ displayName: 'Title', name: 'mediaTitle', type: 'string', default: '', displayOptions: show('media', ['upload']), description: 'Its title in the library. Left empty: the file name.' },
	...returnAll('media'),
	// ---- post
	{
		displayName: 'Type',
		name: 'postType',
		type: 'options',
		options: [
			{ name: 'Image', value: 'image' },
			{ name: 'Story', value: 'story' },
			{ name: 'Text', value: 'text' },
			{ name: 'Video', value: 'video' },
		],
		default: 'image',
		displayOptions: show('post', ['create']),
		description: 'What kind of post',
	},
	postFields(['create']),
	id('postId', 'Post ID', 'post', ['get', 'update', 'delete', 'schedule', 'unschedule'], 'The post’s ID'),
	postFields(['update']),
	{
		displayName: 'When',
		name: 'when',
		type: 'options',
		options: [
			{ name: 'At a Time', value: 'at' },
			{ name: 'Next Queue Slot', value: 'queue' },
			{ name: 'Now', value: 'now' },
		],
		default: 'queue',
		displayOptions: show('post', ['schedule']),
		description: 'When it goes out',
	},
	{ displayName: 'At', name: 'at', type: 'dateTime', required: true, default: '', displayOptions: { show: { resource: ['post'], operation: ['schedule'], when: ['at'] } }, description: 'The time, with its time zone' },
	...returnAll('post'),
	// ---- every read
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: false,
		description:
			'Whether to turn text people wrote ({ untrusted, text }) into plain strings. Leave off when an AI agent reads the output, so it treats that text as data.',
	},
];
