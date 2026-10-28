import WebSocket from "ws";

// the bit of a socket the controller needs. lets tests swap in a fake
export interface SidebandSocket {
  send(data: string): void;
  close(): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
}

export type ConnectSideband = (callId: string) => Promise<SidebandSocket>;

// joins the browser's WebRTC call from the server, per OpenAI's realtime "server controls" docs.
// same session, same events, but authenticated with our real key and invisible to the browser
export function openAISideband(apiKey: string): ConnectSideband {
  return (callId) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      ws.once("open", () =>
        resolve({
          send: (data) => ws.readyState === WebSocket.OPEN && ws.send(data),
          close: () => ws.close(),
          onMessage: (cb) => ws.on("message", (d) => cb(d.toString())),
          onClose: (cb) => ws.on("close", cb),
        }),
      );
      ws.once("error", reject);
    });
}
