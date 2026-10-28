import type { InterviewController } from "./controller.js";

// live interviews by session id, shared by the HTTP routes and the websocket.
// in memory, so a restart drops them; fine for one dev server
const interviews = new Map<string, InterviewController>();

export const registry = {
  get: (id: string) => interviews.get(id),
  set: (id: string, controller: InterviewController) => void interviews.set(id, controller),
  delete: (id: string) => void interviews.delete(id),
};
