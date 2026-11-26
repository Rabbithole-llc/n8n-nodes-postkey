import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/** An ID field: picked from a list, or given by ID. Read with getNodeParameter(name, i, '', { extractValue: true }). */
const pick = (name: string, displayName: string, resource: string, operation: string[], searchListMethod: string, description: string, searchable = true): INodeProperties => ({
	displayName,
	name,
	type: 'resourceLocator',
	required: true,
	default: { mode: 'list', value: '' },
	displayOptions: show(resource, operation),
	description,
	modes: [
		{ displayName: 'From List', name: 'list', type: 'list', typeOptions: { searchListMethod, searchable } },
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 4850775a-6b1c-4f0e-9a51-2a1f6f7c0d11',
			validation: [{ type: 'regex', properties: { regex: UUID, errorMessage: 'Not a valid Postkey ID' } }],
		},
	],
});

const text = (name: string, displayName: string, resource: string, operation: string[], description: string, placeholder?: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	required: true,
	default: '',
	displayOptions: show(resource, operation),
	description,
	...(placeholder ? { placeholder } : {}),
});

const returnAll = (resource: string, operation: string[] = ['getAll']): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: show(resource, operation),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: [resource], operation, returnAll: [false] } },
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
		{ name: 'Video Edit', value: 'videoEdit' },
		{ name: 'Video Edit Template', value: 'videoEditTemplate' },
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
		{ name: 'Get', value: 'get', action: 'Get approval', description: 'Retrieve an approval request and what a person decided' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many approvals', description: 'Retrieve a list of approval requests waiting for a person in Postkey' },
	], 'get'),
	operations('automation', [
		{ name: 'Create', value: 'create', action: 'Create automation', description: 'Create a new draft DM automation from a template' },
		{ name: 'Get', value: 'get', action: 'Get automation', description: 'Retrieve an automation with its messages' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many automations', description: 'Retrieve a list of the profile\'s DM automations' },
		{ name: 'Get Templates', value: 'getTemplates', action: 'Get automation templates', description: 'Retrieve a list of templates an automation can be created from' },
		{ name: 'Pause', value: 'pause', action: 'Pause automation', description: 'Switch a live automation off' },
		{ name: 'Publish', value: 'publish', action: 'Publish automation', description: 'Set an automation live, or send it to Approvals when the key asks first' },
		{ name: 'Update', value: 'update', action: 'Update automation', description: 'Update the draft of an automation' },
	], 'getAll'),
	operations('contact', [
		{ name: 'Get', value: 'get', action: 'Get contact', description: 'Retrieve a contact' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many contacts', description: 'Retrieve a list of contacts, filtered by name, handle or tag' },
		{ name: 'Tag', value: 'tag', action: 'Tag contact', description: 'Add tags to a contact or remove them' },
	], 'getAll'),
	operations('conversation', [
		{ name: 'Get', value: 'get', action: 'Get conversation', description: 'Retrieve a conversation with its messages' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many conversations', description: 'Retrieve a list of Inbox conversations' },
		{ name: 'Reply', value: 'reply', action: 'Reply in conversation', description: 'Send a reply in a conversation, or send it to Approvals when the key asks first' },
	], 'getAll'),
	operations('event', [{ name: 'Get Many', value: 'getAll', action: 'Get many events', description: 'Retrieve a list of events from the last 30 days, newest first' }], 'getAll'),
	operations('media', [
		{ name: 'Get Many', value: 'getAll', action: 'Get many media files', description: 'Retrieve a list of files in the media library' },
		{ name: 'Upload', value: 'upload', action: 'Upload media file', description: 'Add a file from the input to the media library' },
	], 'upload'),
	operations('post', [
		{ name: 'Create', value: 'create', action: 'Create post', description: 'Create a new draft post' },
		{ name: 'Delete', value: 'delete', action: 'Delete post', description: 'Delete a draft post' },
		{ name: 'Get', value: 'get', action: 'Get post', description: 'Retrieve a post' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many posts', description: 'Retrieve a list of the profile\'s posts' },
		{ name: 'Schedule', value: 'schedule', action: 'Schedule post', description: 'Publish a post now, at a time or in the queue, or send it to Approvals when the profile asks first' },
		{ name: 'Unschedule', value: 'unschedule', action: 'Unschedule post', description: 'Turn a scheduled post back into a draft' },
		{ name: 'Update', value: 'update', action: 'Update post', description: 'Update a draft post' },
	], 'create'),
	operations('profile', [{ name: 'Get', value: 'get', action: 'Get profile', description: 'Retrieve the profile, the key and its limits' }], 'get'),
	operations('socialAccount', [{ name: 'Get Many', value: 'getAll', action: 'Get many social accounts', description: 'Retrieve a list of the connected social accounts' }], 'getAll'),
	operations('videoEdit', [
		{ name: 'Clone Style', value: 'cloneStyle', action: 'Clone video style', description: 'Clone the style of one reel, TikTok or Short into a new video edit template' },
		{ name: 'Create', value: 'create', action: 'Create video edit', description: 'Start a new video edit from media library clips' },
		{ name: 'Create Shorts', value: 'createShorts', action: 'Create short video edits', description: 'Create up to 10 short video edits from the edit of a long video' },
		{ name: 'Get', value: 'get', action: 'Get video edit', description: 'Retrieve a video edit with its sentences, clips and captions' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many video edits', description: 'Retrieve a list of the profile\'s video edits' },
		{ name: 'Undo Change', value: 'undoChange', action: 'Undo video edit change', description: 'Undo one change of a video edit' },
		{ name: 'Update', value: 'update', action: 'Update video edit', description: 'Apply a list of changes to a video edit, all or nothing' },
	], 'getAll'),
	operations('videoEditTemplate', [
		{ name: 'Create', value: 'create', action: 'Create video edit template', description: 'Create a new template from the look of a video edit' },
		{ name: 'Get', value: 'get', action: 'Get video edit template', description: 'Retrieve a saved video edit template or cloned style' },
		{ name: 'Get Formats', value: 'getFormats', action: 'Get video edit formats', description: 'Retrieve a list of formats a video edit can start from' },
		{ name: 'Get Many', value: 'getAll', action: 'Get many video edit templates', description: 'Retrieve a list of saved video edit templates and cloned styles' },
		{ name: 'Update', value: 'update', action: 'Update video edit template', description: 'Update a saved video edit template' },
	], 'getAll'),
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
		{ displayName: 'Social Account Names or IDs', name: 'social_account_ids', type: 'multiOptions', default: [], typeOptions: { loadOptionsMethod: 'getSocialAccounts' }, description: 'The social accounts the post goes to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.' },
		{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'An internal title only the team sees' },
	],
});

export const fieldProperties: INodeProperties[] = [
	// ---- approval
	pick('approvalId', 'Approval', 'approval', ['get'], 'searchApprovals', 'The approval request. A call that waits for a person answers with its ID as approval_id.', false),
	// ---- automation
	pick('automationId', 'Automation', 'automation', ['get', 'update', 'publish', 'pause'], 'searchAutomations', 'The DM automation'),
	{
		displayName: 'Template Name or ID',
		name: 'templateKey',
		type: 'options',
		required: true,
		default: '',
		typeOptions: { loadOptionsMethod: 'getAutomationTemplates' },
		displayOptions: show('automation', ['create']),
		description: 'The template the automation is created from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
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
			{ displayName: 'Social Account Names or IDs', name: 'social_account_ids', type: 'multiOptions', default: [], typeOptions: { loadOptionsMethod: 'getSocialAccounts' }, description: 'The social accounts the automation runs on. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.' },
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
	pick('contactId', 'Contact', 'contact', ['get', 'tag'], 'searchContacts', 'The contact'),
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
	pick('conversationId', 'Conversation', 'conversation', ['get', 'reply'], 'searchConversations', 'The Inbox conversation', false),
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
	pick('postId', 'Post', 'post', ['get', 'update', 'delete', 'schedule', 'unschedule'], 'searchPosts', 'The post', false),
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
	// ---- video edit
	// Starting an edit or a clone answers a signed link and a command: the footage is read on a computer, never on
	// Postkey's servers, so the workflow hands the link on (email, Slack) and a person runs it.
	{
		displayName: 'Additional Fields',
		name: 'editFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('videoEdit', ['create']),
		options: [
			{ displayName: 'Brief', name: 'brief', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'What the video is for: the mood, the platform, what to avoid' },
			{ displayName: 'Captions', name: 'captions', type: 'boolean', default: true, description: 'Whether to add captions. On by default unless the footage already has captions.' },
			{ displayName: 'Cut Fillers', name: 'cut_fillers', type: 'boolean', default: true, description: 'Whether to cut filler words such as um and uh (English)' },
			{
				displayName: 'Format Name or ID',
				name: 'format',
				type: 'options',
				default: '',
				typeOptions: { loadOptionsMethod: 'getEditFormats' },
				description: 'The format the edit starts from. Use it or \'Template\', not both. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{ displayName: 'Headline', name: 'headline', type: 'boolean', default: true, description: 'Whether to add a headline. On by default unless the footage already has captions.' },
			{ displayName: 'Language', name: 'language', type: 'string', default: '', placeholder: 'e.g. es', description: 'The language spoken, as a two-letter code, or auto' },
			{ displayName: 'Media IDs', name: 'media_ids', type: 'string', default: '', description: 'Media library videos in the order they play, comma-separated, up to 40. Leave empty to give files on the computer that runs the command.' },
			{
				displayName: 'Roles',
				name: 'roles',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'After', value: 'after' },
					{ name: 'Before', value: 'before' },
					{ name: 'Hook A', value: 'hook_a' },
					{ name: 'Hook B', value: 'hook_b' },
					{ name: 'Intro', value: 'intro' },
					{ name: 'Tip', value: 'tip' },
				],
				description: 'In a format with parts: the part each clip is, in the order of \'Media IDs\'',
			},
			{
				displayName: 'Shape',
				name: 'shape',
				type: 'options',
				default: '9:16',
				options: [
					{ name: '1:1 (Feeds)', value: '1:1' },
					{ name: '16:9 (YouTube, LinkedIn)', value: '16:9' },
					{ name: '4:5 (Feeds)', value: '4:5' },
					{ name: '9:16 (Reels, TikTok, Shorts)', value: '9:16' },
				],
				description: 'The shape of the video',
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description: 'A saved template or cloned style to start from instead of a format',
				modes: [
					{ displayName: 'From List', name: 'list', type: 'list', typeOptions: { searchListMethod: 'searchEditTemplates', searchable: false } },
					{ displayName: 'By ID', name: 'id', type: 'string', placeholder: 'e.g. 4850775a-6b1c-4f0e-9a51-2a1f6f7c0d11' },
				],
			},
			{ displayName: 'Tightness', name: 'tightness', type: 'string', default: '', placeholder: 'e.g. off', description: 'How many pauses to cut. Use off to leave the cut alone. Leave empty for the format\'s own setting.' },
			{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'The name of the edit. Leave empty to use the first words said.' },
			{ displayName: 'Voice-Over ID', name: 'voice_over_id', type: 'string', default: '', description: 'A sound or video in the media library that plays over the clips as a voice-over. Not one of \'Media IDs\'.' },
			{ displayName: 'Words', name: 'words', type: 'string', default: '', placeholder: 'e.g. Postkey, Nathan Smith', description: 'Names and terms to spell right in the captions, comma-separated' },
		],
	},
	text('cloneName', 'Template Name', 'videoEdit', ['cloneStyle'], 'The name of the new template that holds the cloned style', 'e.g. Morning Routine Style'),
	pick('cloneMediaId', 'Video', 'videoEdit', ['cloneStyle'], 'searchVideos', 'The media library video whose style is cloned: its shots, pace, captions, headline, framing and colours, never its words or footage'),
	pick('editId', 'Video Edit', 'videoEdit', ['get', 'update', 'undoChange'], 'searchEdits', 'The video edit', false),
	{
		displayName: 'Options',
		name: 'editGetOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('videoEdit', ['get']),
		options: [
			{ displayName: 'Render Link', name: 'render', type: 'boolean', default: false, description: 'Whether to add a signed link that renders the finished video on a computer' },
			{ displayName: 'Timeline File Link', name: 'timeline', type: 'boolean', default: false, description: 'Whether to add a signed link to the edit as a timeline file for Final Cut Pro, Premiere Pro and DaVinci Resolve' },
			{ displayName: 'Transcript Page', name: 'page', type: 'number', typeOptions: { minValue: 1, maxValue: 50 }, default: 1, description: 'The page of the transcript of a long video' },
		],
	},
	{
		displayName: 'Changes',
		name: 'changes',
		type: 'json',
		required: true,
		default: '[]',
		displayOptions: show('videoEdit', ['update']),
		placeholder: 'e.g. [{ "op": "set_title", "title": "My Title" }]',
		description: 'The changes as a JSON list, in order, each an object with an op. They are applied all or nothing. See the <a href="https://postkey.pro/docs/api">API reference</a> for the operations.',
	},
	{ displayName: 'Note', name: 'changeNote', type: 'string', default: '', displayOptions: show('videoEdit', ['update']), description: 'What changed and why, in one short sentence. Shown to the person beside the change in Postkey.' },
	text('changeId', 'Change ID', 'videoEdit', ['undoChange'], 'The ID of the change to undo, from the changes of the video edit', 'e.g. 4850775a-6b1c-4f0e-9a51-2a1f6f7c0d11'),
	pick('sourceEditId', 'Source Video Edit', 'videoEdit', ['createShorts'], 'searchEdits', 'The edit of the long video', false),
	{
		displayName: 'Clips',
		name: 'clips',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, maxValue: 10 },
		placeholder: 'Add Clip',
		required: true,
		default: {},
		displayOptions: show('videoEdit', ['createShorts']),
		description: 'The moments to turn into short edits, each its own edit',
		options: [
			{
				displayName: 'Clip',
				name: 'clip',
				values: [
					{ displayName: 'From Sentence ID', name: 'from', type: 'string', required: true, default: '', description: 'The ID of the first sentence the clip plays, from Video Edit: Get' },
					{ displayName: 'To Sentence ID', name: 'to', type: 'string', required: true, default: '', description: 'The ID of the last sentence the clip plays' },
					{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'What the clip says, in a few words' },
					{ displayName: 'Reason', name: 'reason', type: 'string', default: '', description: 'One sentence on why this clip was chosen. Shown to the person in Postkey.' },
				],
			},
		],
	},
	{ displayName: 'Any Length', name: 'anyLength', type: 'boolean', default: false, displayOptions: show('videoEdit', ['createShorts']), description: 'Whether to allow clips under 10 seconds or over 3 minutes' },
	// ---- video edit template
	pick('templateEditId', 'Video Edit', 'videoEditTemplate', ['create'], 'searchEdits', 'The video edit whose look is saved as the template', false),
	text('templateName', 'Name', 'videoEditTemplate', ['create'], 'The name of the template, as people see it in Postkey', 'e.g. Weekly Tips'),
	pick('templateId', 'Template', 'videoEditTemplate', ['get', 'update'], 'searchEditTemplates', 'The saved video edit template or cloned style', false),
	{
		displayName: 'Update Fields',
		name: 'templateUpdate',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('videoEditTemplate', ['update']),
		options: [
			{ displayName: 'Brief', name: 'brief', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Notes for a cloned style on how to match what was not measured' },
			{ displayName: 'Look', name: 'look', type: 'json', default: '{}', description: 'The captions and hook settings to lay over the template\'s own, as a JSON object with captions and hook' },
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'A new name. Postkey saves the template as a copy under this name.' },
		],
	},
	...returnAll('videoEdit'),
	...returnAll('videoEditTemplate', ['getAll', 'getFormats']),
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
