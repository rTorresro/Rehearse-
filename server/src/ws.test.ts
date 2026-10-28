import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import WebSocket from "ws";
import {
  MAX_SNAPSHOT_CHARS,
  type CodeSnapshot,
  type HintsState,
  type ServerMessage,
} from "@rehearse/shared";
import type { InterviewController } from "./interview/controller.js";
import { attachInterviewSocket } from "./ws.js";

const ORIGIN = "http://localhost:3000";

// stands in for a live interview; records what the socket hands it
const received: CodeSnapshot[] = [];
let unlocked = 0;
const HINTS = ["first", "second", "third"];
const hintListeners = new Set<(s: HintsState) => void>();
const hintsNow = (): HintsState => ({
  unlocked: HINTS.slice(0, unlocked).map((text, i) => ({ number: i + 1, text })),
  total: HINTS.length,
});
const fakeInterview = {
  receiveCode(s: CodeSnapshot) {
    const newest = received.at(-1)?.version ?? 0;
    if (s.version <= newest) return false;
    received.push(s);
    return true;
  },
  get hints() {
    return hintsNow();
  },
  onHintsChanged(l: (s: HintsState) => void) {
    hintListeners.add(l);
    return () => void hintListeners.delete(l);
  },
  requestHint() {
    if (unlocked >= HINTS.length) return false;
    unlocked++;
    for (const l of hintListeners) l(hintsNow());
    return true;
  },
} as unknown as InterviewController;

let server: Server;
let url: string;

before(async () => {
  server = createServer();
  attachInterviewSocket(server, {
    getInterview: (id) => (id === "live-session" ? fakeInterview : undefined),
    allowedOrigin: ORIGIN,
  });
  await new Promise<void>((r) => server.listen(0, r));
  url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;
});
after(() => server.close());

// opens a socket and collects server messages
async function connect(origin = ORIGIN) {
  const ws = new WebSocket(url, { origin });
  const inbox: ServerMessage[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(d.toString())));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const next = async () => {
    for (let i = 0; i < 100 && inbox.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    return inbox.shift();
  };
  return { ws, next, send: (m: object) => ws.send(JSON.stringify(m)) };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const snapshot = (version: number, extra: object = {}) => ({
  type: "code.snapshot",
  version,
  timestamp: Date.now(),
  language: "python",
  code: `x = ${version}`,
  ...extra,
});

describe("code sync websocket", () => {
  it("rejects connections from other origins", async () => {
    await assert.rejects(connect("http://evil.example"), /Unexpected server response: 401/);
  });

  it("needs a join before snapshots", async () => {
    const c = await connect();
    c.send(snapshot(1));
    assert.deepEqual(await c.next(), { type: "error", message: "join a session first" });
    c.ws.close();
  });

  it("closes the socket for an unknown session", async () => {
    const c = await connect();
    const closed = new Promise<number>((r) => c.ws.once("close", r));
    c.send({ type: "session.join", sessionId: "nope" });
    assert.equal((await c.next())?.type, "error");
    assert.equal(await closed, 4404);
  });

  it("joins, acks new snapshots, and stays quiet on stale ones", async () => {
    received.length = 0;
    const c = await connect();
    c.send({ type: "session.join", sessionId: "live-session" });
    assert.deepEqual(await c.next(), { type: "session.joined", sessionId: "live-session" });
    assert.equal((await c.next())?.type, "hints.state");

    c.send(snapshot(1));
    assert.deepEqual(await c.next(), { type: "code.ack", version: 1 });
    await pause(250);
    c.send(snapshot(1));
    await pause(250);
    c.send(snapshot(2));
    assert.deepEqual(await c.next(), { type: "code.ack", version: 2 });
    assert.deepEqual(
      received.map((s) => s.version),
      [1, 2],
    );
    c.ws.close();
  });

  it("rejects malformed snapshots", async () => {
    const c = await connect();
    c.send({ type: "session.join", sessionId: "live-session" });
    await c.next();
    await c.next();
    for (const bad of [{ version: 0 }, { version: 1.5 }, { language: "cobol" }, { code: 42 }]) {
      c.send(snapshot(100, bad));
      assert.deepEqual(await c.next(), { type: "error", message: "malformed snapshot" });
      await pause(250);
    }
    c.send(snapshot(100, { code: "x".repeat(MAX_SNAPSHOT_CHARS + 1) }));
    assert.deepEqual(await c.next(), { type: "error", message: "malformed snapshot" });
    c.ws.close();
  });

  it("drops snapshots that arrive faster than any debounced editor sends them", async () => {
    received.length = 0;
    const c = await connect();
    c.send({ type: "session.join", sessionId: "live-session" });
    await c.next();
    await c.next();
    for (let v = 1; v <= 5; v++) c.send(snapshot(v));
    await pause(150);
    assert.deepEqual(
      received.map((s) => s.version),
      [1],
    );
    c.ws.close();
  });
});

describe("hints over the websocket", () => {
  it("sends the hint state on join and after each unlock, and stops at the last hint", async () => {
    unlocked = 0;
    const c = await connect();
    c.send({ type: "session.join", sessionId: "live-session" });
    await c.next();
    assert.deepEqual(await c.next(), { type: "hints.state", unlocked: [], total: 3 });

    c.send({ type: "hint.request" });
    assert.deepEqual(await c.next(), {
      type: "hints.state",
      unlocked: [{ number: 1, text: "first" }],
      total: 3,
    });
    c.send({ type: "hint.request" });
    c.send({ type: "hint.request" });
    await c.next();
    assert.equal(((await c.next()) as HintsState).unlocked.length, 3);

    // nothing left: the server just repeats the state so the button can settle
    c.send({ type: "hint.request" });
    assert.equal(((await c.next()) as HintsState).unlocked.length, 3);
    assert.equal(unlocked, 3);
    c.ws.close();
  });

  it("needs a join before asking for hints", async () => {
    const c = await connect();
    c.send({ type: "hint.request" });
    assert.deepEqual(await c.next(), { type: "error", message: "join a session first" });
    c.ws.close();
  });
});
