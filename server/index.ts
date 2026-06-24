const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map<roomCode, Map<ws, { username, joinedAt }>>
const rooms = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoomUsers(roomCode : any) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return Array.from(room.values()).map((u : any) => u.username);
}

function broadcastToRoom(roomCode : any, data : any, exclude = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const [ws] of room) {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

function send(ws : any, data : any) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function leaveRoom(ws : any) {
  const room = rooms.get(ws._room);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) {
    rooms.delete(ws._room);
  } else {
    broadcastToRoom(ws._room, {
      type: "system",
      content: `${ws._username} left the room`,
      users: getRoomUsers(ws._room),
      timestamp: Date.now(),
    });
  }
}

// ─── WebSocket ─────────────────────────────────────────────────────────────────

wss.on("connection", (ws: any) => {
  console.log(`[NEW] ${new Date().toISOString()}`);  // ← add this
  ws._room = null;
  ws._username = null;

  ws.on("close", (code: any, reason: any) => {       // ← add this whole block
    console.log(`[CLOSE] code:${code} room:${ws._room}`);
  });

  ws.on("message", (raw : any) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (data.type) {
      // ── Join or create a room ──────────────────────────────────────────────
      case "join": {
        const roomCode = data.roomCode?.toUpperCase().trim();
        const username = data.username?.trim();
        if (!roomCode || !username) return;

        // Leave any existing room first
        if (ws._room) leaveRoom(ws);

        if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
        rooms.get(roomCode).set(ws, { username, joinedAt: Date.now() });
        ws._room = roomCode;
        ws._username = username;

        // Confirm join to the joining client
        send(ws, {
          type: "joined",
          roomCode,
          username,
          users: getRoomUsers(roomCode),
          timestamp: Date.now(),
        });

        // Notify everyone else in the room
        broadcastToRoom(
          roomCode,
          {
            type: "system",
            content: `${username} joined the room`,
            users: getRoomUsers(roomCode),
            timestamp: Date.now(),
          },
          ws // exclude the joiner (they got "joined" above)
        );
        break;
      }

      // ── Send a chat message ────────────────────────────────────────────────
      case "message": {
        if (!ws._room || !data.content?.trim()) return;
        broadcastToRoom(ws._room, {
          type: "message",
          username: ws._username,
          content: data.content.trim(),
          timestamp: Date.now(),
        });
        break;
      }
    }
  });

  ws.on("close", () => {
    if (ws._room) leaveRoom(ws);
  });

  ws.on("error", (err : any) => {
    console.error("WS error:", err.message);
  });
});

// ─── REST ──────────────────────────────────────────────────────────────────────

// Check if a room exists (used by the lobby to validate join codes)
app.get("/room/:code", (req : any, res : any) => {
  const code = req.params.code.toUpperCase();
  const exists = rooms.has(code);
  res.json({
    exists,
    users: exists ? getRoomUsers(code) : [],
  });
});

// Health check
app.get("/health", (_ : any, res : any) =>
  res.json({ ok: true, activeRooms: rooms.size })
);

// ─── Boot ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`\n🚀  Chat server  →  http://localhost:${PORT}\n`)
);