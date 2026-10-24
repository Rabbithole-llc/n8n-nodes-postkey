import type { INodePropertyOptions } from 'n8n-workflow';

/** The event types an endpoint may take (GET /api/v1/event-types, subscribable). */
export const EVENT_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Approval Decided', value: 'approval.decided', description: 'A person approved or rejected a request, or it lapsed or failed' },
	{ name: 'Approval Requested', value: 'approval.requested', description: 'Something waits in Approvals for a person' },
	{ name: 'Automation Paused', value: 'automation.paused', description: 'An automation was paused' },
	{ name: 'Automation Published', value: 'automation.published', description: 'An automation was set live' },
	{ name: 'Automation Triggered', value: 'automation.triggered', description: 'An automation started for a person (a comment, a DM keyword, a story reply)' },
	{ name: 'Comment Received', value: 'comment.received', description: 'Someone commented on one of the profile’s posts' },
	{ name: 'Contact Created', value: 'contact.created', description: 'A new person wrote to the profile or met one of its automations' },
	{ name: 'Email Collected', value: 'contact.email_collected', description: 'An automation asked for an email address and got one' },
	{ name: 'Message Failed', value: 'message.failed', description: 'A direct message Postkey sent did not arrive' },
	{ name: 'Message Received', value: 'message.received', description: 'Someone sent the profile a direct message' },
	{ name: 'Message Sent', value: 'message.sent', description: 'Postkey sent a direct message' },
	{ name: 'Post Failed', value: 'post.failed', description: 'A post did not publish to any of its social accounts' },
	{ name: 'Post Published', value: 'post.published', description: 'A post finished publishing (published, or partial)' },
	{ name: 'Post Scheduled', value: 'post.scheduled', description: 'A post was scheduled, or sent to publish now' },
	{ name: 'Social Account Connected', value: 'social_account.connected', description: 'A social account was connected or reconnected' },
	{ name: 'Social Account Disconnected', value: 'social_account.disconnected', description: 'A social account needs reconnecting in Postkey' },
];
