# n8n-nodes-postkey

[Postkey](https://postkey.pro) for [n8n](https://n8n.io): schedule posts, run DM automations, edit videos, tag contacts,
reply in the Inbox, and start workflows when something happens in Postkey.

## Install

In n8n: **Settings > Community Nodes > Install**, then `n8n-nodes-postkey`.

## Credentials

1. In Postkey, open **Agent & API** and make an agent key. Pick what it may do. For the trigger, include **Webhooks**.
2. In n8n, add a **Postkey API** credential and paste the key. n8n checks it with `GET /api/v1/me`.

A key that **asks first** (the default) never publishes or sends anything by itself. Scheduling a post, turning an
automation on and sending a reply then answer `status: waiting_for_approval`, and a person approves them in Postkey
under Posts > Approvals. That is not an error. Follow it with **Approval: Get** or the **Approval Decided** event.

## Nodes

**Postkey**:

- **Post**: create, get, get many, update, delete, schedule, unschedule
- **Media**: upload a file from the input, get many
- **Automation**: create from a template, get, get many, update, publish, pause, get templates
- **Contact**: get, get many, tag
- **Conversation**: get, get many, reply
- **Video Edit**: create, clone style, create shorts from a long video, get, get many, update, undo change
- **Video Edit Template**: create from an edit, get, get many, update, get formats
- **Approval**: get, get many
- **Event**: get many
- **Social Account**: get many
- **Profile**: get

Posts, automations, contacts, conversations, video edits and templates are picked from a list, or given by ID. Every
write sends an `Idempotency-Key` that stays the same when n8n retries an item, so a retry never posts or sends twice.

**Video edits run on a computer.** Postkey reads footage on the computer of the person who edits, not on its servers.
So **Video Edit: Create** and **Clone Style** answer with a signed link and a command. Send them on (email, Slack) and
the person runs them. After that, the workflow can read the edit, change it, cut shorts and save templates.

**Postkey Trigger**: pick the events (a comment, a DM, a new contact, an email collected, a post published or failed,
an automation triggered, an approval asked or decided, and more). When the workflow is switched on the node makes a
webhook endpoint in Postkey; switched off, it deletes it. Every delivery's signature is checked (Standard Webhooks)
and a delivery that does not match is refused. The workflow's address must be reachable from the internet over HTTPS.
Webhooks come with a paid Postkey plan; on Free, use **Event: Get Many** on a schedule instead.

**Simplify**: text people wrote reaches you as `{ "untrusted": true, "text": "..." }`, so an AI agent treats it as data,
never as instructions. Turn Simplify on to get plain strings.

## Example workflows

- **Tag people who comment.** Postkey Trigger (Comment Received) > Postkey (Contact: Tag).
- **Post from a spreadsheet.** Google Sheets (new row) > HTTP Request (download the file) > Postkey (Media: Upload) >
  Postkey (Post: Create) > Postkey (Post: Schedule).
- **Tell the team when a post fails.** Postkey Trigger (Post Failed) > Slack (send message).
- **Hand an edit to the editor.** Postkey (Video Edit: Create) > Gmail (send the link and the command).

## Limits

The key's limits apply: requests a minute and actions a day (smaller on the Free plan). A `429` says when to try
again. See [postkey.pro/docs/api](https://postkey.pro/docs/api).

## License

MIT
