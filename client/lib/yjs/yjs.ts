import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function createRoomDocument(roomId : any) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    "wss://codifyr-server.example.com",
    roomId,
    ydoc
  );
  return { ydoc, provider };
}

import { MonacoBinding } from "y-monaco";

export function bindEditor(editor:any, ydoc:any, provider:any) {
  const yText = ydoc.getText("codeContent");
  new MonacoBinding(
    yText,
    editor.getModel(),
    new Set([editor]),
    provider.awareness
  );
}



