import { encode as cborEncode } from "@atcute/cbor";
import type { At } from "@atcute/client/lexicons";
import { concat as ui8Concat } from "uint8arrays";
import { createBaseRewriter, ManifestUpdater } from "./rewriter";
import has from 'just-has';

function createErrorFrame(body: unknown): Uint8Array {
  const header = { op: -1 };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

function createFrame(body: unknown, type?: string): Uint8Array {
  const header = { op: 1, t: type };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

const LABEL_VERSION = 1;

async function replay(env: any, sub: WebSocket, cursor: number | null) {
  const labelSrc:string = env.LABEL_SRC;
  const labelVal:string = env.LABEL_VAL;
  const startPoint:number = (cursor === null) ? 0 : Number(cursor);
  let rows = [];
  const { results } = await env.DB.prepare("SELECT * FROM labeled where id >= ? LIMIT 100").bind(startPoint).all();
  for (const user of results) {
    rows.push({
      id: user.id,
      uri: user.account,
      neg: user.neg == 1,
      val: labelVal,
      cts: user.time
    });
  }

  // if we are out of data
  if (rows.length == 0 && startPoint > 0) {
    console.error("Requested a future cursor that does not exist.");
    sub.send(createErrorFrame({
      error: "FutureCursor",
      message: "Cursor is in the future",
		}));
    sub.close();
    // perhaps this should be terminate?
    return;
  }

  for (const row of rows) {
    if (row.id < (cursor ?? 0)) {
      continue;
    }

    // https://atproto.com/specs/label#schema-and-data-model
    const label = {
      ver: LABEL_VERSION,
      src: labelSrc as At.DID,
      uri: row.uri,
      val: row.val,
      neg: row.neg,
      cts: row.cts,
    };

    const bytes = createFrame(
      {
        seq: row.id,
        labels: [label],
      },
      "#labels"
    );
    sub.send(bytes);
  }
  // shouldn't be necessary, but w/e
  rows = [];
}

let subscribers: WebSocket[] = [];

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname == "/xrpc/com.atproto.label.subscribeLabels" ||
        url.pathname == "//xrpc/com.atproto.label.subscribeLabels") {
      // Set up WS connection.
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      server.addEventListener("close", () => {
        server.close();
      });

      subscribers.push(server);
      replay(env, server, cursor).catch(reason => console.error(reason));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } else if (url.pathname === "/count") {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      let response = await cache.match(cacheKey);
      if (!response) {
        try {
          // calculate the new count if it's not already in the cache
          const {results} = await env.DB.prepare("select count(id) from labeled where neg == 0").run();
          let countVal:string = "0";
          // make sure we have results
          if (results.length > 0) {
            countVal = (results[0]["count(id)"]) as string ?? "0";
          }
          // generate the response
          response = new Response(countVal, {status: 200});
          // set this to live for minimum 1 hour
          const countCacheHour:number = Number(env.COUNT_CACHE_HOUR) ?? 1;
          response.headers.append("Cache-Control", `s-maxage=${3600 * countCacheHour}`);
          // dump to cache
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        } catch(err) {
          response = new Response("0", {status: 503});
        }
      }
      return response;
    } else if (url.pathname === "/add-account" || url.pathname === "/add-self") {
      // drop non post requests
      if (request.method !== "POST") {
        return new Response("<b>ERROR</b>: You cannot submit data this way", {status: 405});
      }

      const formData = await request.formData();
      let domainName:string|null|undefined|File = formData.get("domain");
      if (domainName === "" || domainName === undefined || domainName === null || domainName instanceof File) {
        return new Response("<b>ERROR</b>: Bad data was passed. Please check input and try again.", {status: 406});
      }
      // remove @ symbols, clean up input
      domainName = domainName.replace("@","").trim().toLowerCase();
      if (domainName.length > 255) {
        return new Response("<b>ERROR</b>: Domain is too long", {status: 416});
      }
      // check if domain
      const domainRegex = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainName.match(domainRegex)) {
        return new Response("<b>ERROR</b>: Invalid domain", {status: 406});
      }
      // Alternative Lookup URLs:
      // https://leccinum.us-west.host.bsky.network/xrpc/com.atproto.identity.resolveHandle?handle=
      // https://quickdid.smokesignal.tools/xrpc/com.atproto.identity.resolveHandle?handle=
      const resolverURL:string = "https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=";
      const response = await fetch(`${resolverURL}${domainName}`, {
        cf: {
          cacheTtl: 30,
          cacheEverything: true,
        }
      });
      if (response.ok) {
        const json:any = await response.json();
        if (!has(json, "did")) {
          return new Response("<b>ERROR</b>: Could not resolve account", {status: 400});
        }
        const inputDID = json.did;

        try {
          await env.DB.prepare("INSERT INTO labeled (id, account) VALUES (NULL, ?)").bind(inputDID).run();
        } catch(err) {
          return new Response("<b>ERROR</b>: Already exists. Someone may have added you already!", {status: 400});
        }
        console.log(`Added ${domainName}`);
        return new Response("<ins>Added!</ins>", {status: 200});
      }
      else {
        return new Response("<b>ERROR</b>: Cannot find user account on Bluesky!", {status: 404});
      }
    } else if (url.pathname === "/" || url.pathname === "/index.html") {
      const mainHTML = await env.ASSETS.fetch(new Request(url.origin + '/index.html'));
      return createBaseRewriter(env, url.origin).transform(mainHTML);
    } else if (url.pathname === "/site.webmanifest") {
      const manifestFile = await env.ASSETS.fetch(new Request(url.origin + '/site.webmanifest'));
      return new HTMLRewriter().onDocument(new ManifestUpdater(env)).transform(manifestFile);
    }

    const notFoundHTML = await env.ASSETS.fetch(new Request(url.origin + '/404.html'));
    return createBaseRewriter(env, url.origin).transform(notFoundHTML);
  },
} satisfies ExportedHandler<Env>;
