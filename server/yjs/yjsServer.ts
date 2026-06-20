/**
 * Yjs collaboration server.
 *
 * Runs separately from the chat WebSocket server (index.ts, port 5000).
 * Each room code becomes a Yjs "document name" — clients connecting with
 * the same room code share the same Y.Doc and stay in sync automatically.
 *
 * Start with: npx ts-node yjs/yjsServer.ts
 * (or add a script in package.json — see notes at the bottom of this file)
 */

import { WebSocketServer } from "ws";
import http from "http";

// y-websocket ships a ready-made connection handler that wires a raw
// `ws` WebSocket up to a Yjs document, including awareness (cursor
// position / selection / user presence) and persistence hooks.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection } = require("y-websocket/bin/utils");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "yjs-server" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  // y-websocket reads the room/document name from the request URL path,
  // e.g. ws://localhost:5001/ABC123  ->  doc name "ABC123"
  setupWSConnection(ws, req);
});

const PORT = process.env.YJS_PORT || 5001;
server.listen(PORT, () => {
  console.log(`\n🧩  Yjs sync server  →  ws://localhost:${PORT}\n`);
});