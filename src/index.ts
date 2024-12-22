import { encode as cborEncode } from "@atcute/cbor";
import type { At } from "@atcute/client/lexicons";
import { concat as ui8Concat } from "uint8arrays";

function createErrorFrame(body: unknown): Uint8Array {
  const header = { op: -1 };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

function createFrame(body: unknown, type?: string): Uint8Array {
  const header = { op: 1, t: type };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

const LABEL_VERSION = 1;

async function replay(sub: WebSocket, cursor: number | null) {
  // TODO: Read from your DB any rows after `cursor`. The below is some dummy data.
  const rows = [
    {
      id: 0,
      src: "did:plc:3og4uthwqpnlasfb4hnlyysr", // @labelertest42.bsky.social
      uri: "did:plc:z72i7hdynmk6r22z27h6tvur", // @bsky.app
      val: "verified-human",
      cts: "2024-12-21T19:45:01.398Z",
    },
    {
      id: 1,
      src: "did:plc:3og4uthwqpnlasfb4hnlyysr", // @labelertest42.bsky.social
      uri: "did:plc:oc6vwdlmk2kqyida5i74d3p5", // @support.bsky.team
      val: "verified-human",
      cts: "2024-12-22T19:45:01.398Z",
    }
  ];

  for (const row of rows) {
    if (row.id < (cursor ?? 0)) {
      continue;
    }

    // https://atproto.com/specs/label#schema-and-data-model
    const label = {
      ver: LABEL_VERSION,
      src: row.src as At.DID, // @labelertest42.bsky.social
      uri: row.uri, // @bsky.app
      val: row.val,
      neg: false,
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
}

let subscribers: WebSocket[] = [];

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    console.log("URL: ", request.url);
    console.log("Request: ", JSON.stringify(new Map(request.headers)));
    console.log("Text: ", await request.text());

    if (url.pathname == "/xrpc/com.atproto.label.subscribeLabels") {
      // Set up WS connection.
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      subscribers.push(server);
      replay(server, cursor).catch(reason => console.error(reason));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("404", { status: 404 });

  },
} satisfies ExportedHandler<Env>;
