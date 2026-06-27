export function useChatMessages(wsRef) {

    function send(content: string, username: string) {

        wsRef.current?.send(
            JSON.stringify({
                type: "message",
                content,
                username,
            })
        );
    }

    return { send };
}