// Pending

import type { Message } from "@/types/wstypes";

interface HandlerProps {
    data: any;
    setUsers: React.Dispatch<React.SetStateAction<string[]>>;
    addMessage: (message: Message) => void;
}

export function handleIncomingMessage({
    data,
    setUsers,
    addMessage,
}: HandlerProps) {

    switch (data.type) {

        case "joined":
            setUsers(data.users);

            addMessage({
                type: "system",
                content: `You joined room ${data.roomCode}`,
                timestamp: Date.now(),
            });

            break;

        case "system":
            setUsers(data.users);

            addMessage({
                type: "system",
                content: data.content,
                timestamp: data.timestamp,
            });

            break;

        case "message":
            addMessage(data);
            break;

        default:
            console.warn("Unknown websocket message:", data);
    }
}