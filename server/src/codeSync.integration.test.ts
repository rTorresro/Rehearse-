// the whole path for real: browser websocket -> /ws -> registry -> controller -> the system
// messages the realtime model receives. only the OpenAI sideband socket is faked
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, it } from "node:test";
import WebSocket from "ws";
import { InterviewController } from "./interview/controller.js";
import { registry } from "./interview/registry.js";
import type { SidebandSocket } from "./interview/sideband.js";
import { newSession } from "./interview/testHelpers.js";
import { attachInterviewSocket } from "./ws.js";

const ORIGIN = "http://localhost:3000";
const toModel: { type: string; item?: { role?: string; content?: { text: string }[] } }[] = [];
let server: Server;
let url: string;
let controller: InterviewController;

before(async () => {
  controller = new InterviewController(newSession(), { codeForwardMs: 0, log: () => {} });
  const sideband: SidebandSocket = {
    send: (d) => toModel.push(JSON.parse(d)),
    close: () => {},
    onMessage: () => {},
    onClose: () => {},
  };
  await controller.attach("rtc_test", async () => sideband);
  registry.set("integration", controller);

  server = createServer();
  attachInterviewSocket(server, { getInterview: registry.get, allowedOrigin: ORIGIN });
  await new Promise<void>((r) => server.listen(0, r));
  url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;
});

after(() => {
  controller.dispose();
  registry.delete("integration");
  server.close();
});

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const codeToModel = () =>
  toModel.filter((m) => m.item?.role === "system").map((m) => m.item!.content![0]!.text);

it("a snapshot sent over the websocket reaches the model as code context", async () => {
  const ws = new WebSocket(url, { origin: ORIGIN });
  const acks: number[] = [];
  ws.on("message", (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === "code.ack") acks.push(msg.version);
  });
  await new Promise((r) => ws.once("open", r));
  ws.send(JSON.stringify({ type: "session.join", sessionId: "integration" }));
  await pause(50);

  const send = (version: number, code: string) =>
    ws.send(
      JSON.stringify({
        type: "code.snapshot",
        version,
        timestamp: Date.now(),
        language: "python",
        code,
      }),
    );

  send(1, "def merge_slots(slots):\n    slots.sort()\n    return slots");
  await pause(250);
  const long = Array.from({ length: 90 }, (_, i) => `    step_${i} = ${i}`);
  send(2, long.join("\n"));
  await pause(250);
  long[40] = "    step_40 = slots[0]  # bug?";
  send(3, long.join("\n"));
  await pause(100);

  assert.deepEqual(acks, [1, 2, 3]);
  assert.equal(controller.session.code?.version, 3);

  const [first, second, third] = codeToModel();
  assert.match(first ?? "", /^Code snapshot v1 \(python, 3 lines/);
  assert.ok(first?.includes("2|     slots.sort()"), first ?? "no first message");
  assert.match(second ?? "", /^Code snapshot v2 \(python, 90 lines/);
  // the small edit to a long file goes as a diff, a fraction of the file's size
  assert.match(third ?? "", /^Code update v3/);
  assert.ok(third!.includes("+41|     step_40 = slots[0]  # bug?"), third ?? "no third message");
  assert.ok(third!.length < long.join("\n").length / 4, `diff is ${third!.length} chars`);
  ws.close();
});
