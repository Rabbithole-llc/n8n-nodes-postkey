# Changelog

## 0.1.0

- The Postkey node: posts (create, get, update, delete, schedule, unschedule), media upload, DM automations (from a
  template, update, publish, pause), contacts (find, tag), the Inbox (conversations, reply), approvals, the event log,
  social accounts and the profile.
- Video edits: create an edit, clone a style, create shorts from a long video, get, update, undo a change; and video
  edit templates: create from an edit, get, update, list formats.
- Posts, automations, contacts, conversations, video edits and templates are picked from a list or given by ID; social
  accounts and templates are dropdowns.
- The Postkey Trigger node: registers its own webhook when the workflow is switched on, deletes it when it is switched
  off, and checks every delivery's Standard Webhooks signature.
- The Postkey API credential: an agent key, checked with GET /api/v1/me.
