import { Status } from "@/types/wstypes";
import { useCallback, useRef, Dispatch, SetStateAction } from "react";

const WS_URL = "ws://localhost:5000";

export function useChatSocket({
  setStatus,
  setUsers,
  addMessage,
}: {
  setStatus: Dispatch<SetStateAction<Status>>;
  setUsers: Dispatch<SetStateAction<string[]>>;
  addMessage: (message: any) => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(
    (roomCode: string, name: string) => {
      if (wsRef.current) {
        (wsRef.current as any)._intentionalClose = true;
        wsRef.current.close();
      }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Socket opened");
        setStatus("connected");

        ws.send(
          JSON.stringify({
            type: "join",
            roomCode,
            username: name,
          })
        );
      };

      ws.onmessage = (e) => {
        let data;

        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }

        if (data.type === "joined") {
          setUsers(data.users);

          addMessage({
            type: "system",
            content: `You joined room ${data.roomCode}`,
            timestamp: Date.now(),
          });
        } else if (data.type === "system") {
          setUsers(data.users);

          addMessage({
            type: "system",
            content: data.content,
            timestamp: data.timestamp,
          });
        } else if (data.type === "message") {
          addMessage(data);
        }
      };

      ws.onclose = (event) => {
        console.log("Socket closed", event.code, event.reason);
        setStatus("disconnected");

        if ((ws as any)._intentionalClose) return;

        reconnectRef.current = setTimeout(() => {
          const storedName = sessionStorage.getItem("chat_username");

          if (storedName && roomCode) {
            connect(roomCode, storedName);
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.log("Socket error", err);
        setStatus("disconnected");
      };
    },
    [addMessage, setStatus, setUsers]
  );

  const disconnect = () => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
    }

    if (wsRef.current) {
      (wsRef.current as any)._intentionalClose = true;
      wsRef.current.close();
    }
  };

  return {
    connect,
    disconnect,
    wsRef,
  };
}