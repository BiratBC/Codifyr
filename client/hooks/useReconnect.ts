// Pending

import { useRef } from "react";

export function useReconnect() {

    const reconnectRef = useRef<NodeJS.Timeout | null>(null);

    function schedule(callback: () => void) {

        clear();

        reconnectRef.current = setTimeout(callback, 3000);
    }

    function clear() {

        if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
        }
    }

    return {
        schedule,
        clear,
    };
}