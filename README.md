# Simple account-only Bluesky labeler

This is a very barebones Cloudflare Worker which acts as a Bluesky labeler
service.

It omits some features like signatures and support for the `queryLabels` endpoint,
but seems to work just fine with the native bsky.app web and iOS app.