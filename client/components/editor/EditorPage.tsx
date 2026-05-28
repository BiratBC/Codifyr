"use client"
import { useEffect, useState } from "react";
import { socket } from "../../lib/websocket/socket"

const EditorPage = () => {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<string[]>([]);

    const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send_message", message);
    setMessage("");
    };


    useEffect(() => {
    socket.on("receive_message", (data : any) => {
      setMessages((prev : any) => [...prev, data]);
    });

    return () => {
      socket.off("receive_message");
    };
    }, []);

  return (
    <>
    <div>
      <div style={{ height: "200px", overflowY: "auto" }}>
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
    
    </>
  )
}

export default EditorPage