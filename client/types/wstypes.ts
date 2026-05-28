export type Status =
  | "connecting"
  | "connected"
  | "disconnected";

export type Message =
  | {
      id?: string;
      type: "system";
      content: string;
      timestamp: number;
    }
  | {
      id?: string;
      type: "message";
      username: string;
      content: string;
      timestamp: number;
    };