// Loopback HTTP and WebSocket transport for `vocab.mjs serve`. GET returns the page; a socket on a path
// ending in /ws with the right token carries JSON messages. Each message gets one reply with its id;
// handle() may also push messages without an id later.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";

export async function startServer({ port, token, page, runtimeDir, handle }) {
  let WebSocketServer;
  try {
    ({ WebSocketServer } = createRequire(join(runtimeDir, "package.json"))("ws"));
  } catch {
    throw new Error(`serve needs the ws package; install it once with: npm install --prefix "${runtimeDir}" ws@8`);
  }
  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(page);
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.endsWith("/ws") || url.searchParams.get("token") !== token) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => {
      const push = (message) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
      };
      ws.on("message", (data) => {
        let message;
        try {
          message = JSON.parse(String(data));
        } catch {
          push({ ok: false, error: "messages must be JSON." });
          return;
        }
        Promise.resolve()
          .then(() => handle(message, push))
          .then((reply) => push({ id: message.id, ok: true, data: reply }),
            (error) => push({ id: message.id, ok: false, error: error.message }));
      });
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server.address().port;
}
