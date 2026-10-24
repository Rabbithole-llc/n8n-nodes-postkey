import type { IAuthenticateGeneric, Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * A Postkey agent key: made in Postkey under Agent & API. It works on one Postkey profile, as the person who made it,
 * with that person's role. The key that asks first (the default) never sends or publishes anything by itself: those
 * calls wait in Postkey for a person to approve them.
 */
export class PostkeyApi implements ICredentialType {
	name = 'postkeyApi';

	displayName = 'Postkey API';

	icon: Icon = { light: 'file:../icons/postkey.svg', dark: 'file:../icons/postkey.dark.svg' };

	documentationUrl = 'https://postkey.pro/docs/api#auth';

	properties: INodeProperties[] = [
		{
			displayName: 'Agent Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'An agent key from Postkey, under Agent & API. It starts with pkk_.',
		},
		{
			displayName: 'Postkey Address',
			name: 'baseUrl',
			type: 'string',
			default: 'https://postkey.pro',
			description: 'Leave as it is unless Postkey gave you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1',
			url: '/me',
			method: 'GET',
		},
	};
}
