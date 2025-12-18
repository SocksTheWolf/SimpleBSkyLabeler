# Simple BSky Label Service

This is a very barebones Cloudflare Worker which acts as a Bluesky labeler service.  

Allows for users to sign up for a single label you provide and display it on their profiles.

Stores everything in an D1 db, you can import them by using `npm run setup`.

Uses Skyware to initially set up the label service for the account. Use
`npx @skyware/labeler setup` to initialize the label service, `npx @skyware/labeler label add` to create a label.

## To Customize

* Modify html files in the `html/transforms` folder.
* Modify the images `html/favicon.ico` and everything in `html/img`. You can use [this site](https://favicon.io/favicon-converter/) to convert an image to the various favicon formats. You should not modify the `site.webmanifest`, as this project automatically updates that for you.
* Set the routes in the `wrangler.toml` to your domain
* Modify the `[vars]` in `wrangler.toml` to change the values of:
  * SITE_TITLE
  * SITE_DESCRIPTION
  * SITE_SHORTNAME
  * LABEL_SRC
  * LABEL_VAL

## Stack

* CF Workers
* CF D1
* PicoCSS
* HTMX
* HTMX Response Targets
