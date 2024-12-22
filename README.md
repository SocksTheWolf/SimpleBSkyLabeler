# Simple account-only Bluesky labeler

This is a very barebones Cloudflare Worker which acts as a Bluesky labeler
service.

It omits some features like signatures and support for the `queryLabels` endpoint,
but seems to work just fine with the native bsky.app web and iOS app.

The idea behind this is to be simple and avoid the complexity present in full
featured labelers, which include a database and a full server that responds to
HTTP requests. I hope you can use this as a good starting point, it should be
fairly easy to translate it to other languages/frameworks too if necessary.

The below sections explain how to set up your account as a labeler and how to
deploy this worker. These steps are fairly simple and you should have a working
within 5 minutes.

## Account setup

1. Create a new Bluesky account (do not reuse a personal account for this!)
2. Run `npx @skyware/labeler setup` and follow the wizard to convert that account into a labeler
3. The URL of the labeler will be `https://bsky-labeler.<YourUsername>.workers.dev/`.
4. The label we use in this example is `verified-human`. You can easily change this though.

## Worker deployment

Once your account is set up properly, you can deploy your worker by running
`wrangler deploy` in this repo's directory.

## Testing the labeler

You should then be able to test your new labeler by subscribing to it (just go
on its profile), then if you view the profile for bsky.app you should see
the new label.