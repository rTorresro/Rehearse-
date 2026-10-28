import type { RealtimeEvent } from "./types";

// WebRTC straight from the browser to OpenAI, which is what their realtime docs recommend
// for clients. audio rides the media tracks; everything else is JSON on a data channel
const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

type Options = {
  clientSecret: string;
  mic: MediaStream;
  audioEl: HTMLAudioElement;
  // the interviewer's audio as a stream, for anything that wants to analyse it
  onRemoteStream?: (stream: MediaStream) => void;
  onEvent: (event: RealtimeEvent) => void;
  onConnectionLost: () => void;
};

// OpenAI turned the call down. status and code say why (out of credits, rate limited, bad key)
export class RealtimeCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

export type RealtimeConnection = {
  // OpenAI's id for this call, from the SDP answer's Location header. the server uses it
  // to join the same call over a sideband socket
  callId: string | null;
  send: (event: RealtimeEvent) => void;
  close: () => void;
};

export async function connectRealtime({
  clientSecret,
  mic,
  audioEl,
  onRemoteStream,
  onEvent,
  onConnectionLost,
}: Options): Promise<RealtimeConnection> {
  const pc = new RTCPeerConnection();

  pc.addEventListener("track", (e) => {
    const stream = e.streams[0];
    if (!stream) return;
    audioEl.srcObject = stream;
    onRemoteStream?.(stream);
  });
  for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);

  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("message", (e) => {
    try {
      onEvent(JSON.parse(e.data) as RealtimeEvent);
    } catch {
      // not ours to crash over
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    // "disconnected" often recovers by itself, "failed" doesn't
    if (pc.connectionState === "failed") onConnectionLost();
  });

  let callId: string | null;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const res = await fetch(CALLS_URL, {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new RealtimeCallError(
        res.status,
        body?.error?.code ?? null,
        body?.error?.message ?? `realtime call failed (${res.status})`,
      );
    }
    callId = res.headers.get("Location")?.split("/").pop() ?? null;

    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await channelOpen(dc);
  } catch (err) {
    pc.close();
    throw err;
  }

  return {
    callId,
    send(event) {
      if (dc.readyState === "open") dc.send(JSON.stringify(event));
    },
    close() {
      dc.close();
      pc.close();
    },
  };
}

function channelOpen(dc: RTCDataChannel) {
  if (dc.readyState === "open") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    dc.addEventListener("open", () => resolve(), { once: true });
    dc.addEventListener("error", () => reject(new Error("data channel failed")), { once: true });
  });
}
