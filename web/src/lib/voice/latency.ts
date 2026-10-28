// times one turn: from the moment you let go of the mic to the moment you hear the reply,
// with the steps in between so it's obvious where the time goes

type Mark = "commit" | "responseCreated" | "firstText" | "serverAudio" | "heard";

export type LatencyTracker = {
  release: () => void;
  mark: (m: Mark) => void;
  cancel: () => void;
  // reply ended without us hearing an onset (silent reply, detector missed it): log what we have
  flush: () => void;
};

export function createLatencyTracker(log: (msg: string) => void = console.info): LatencyTracker {
  let turn: { releasedAt: number; marks: Partial<Record<Mark, number>> } | null = null;

  function flush() {
    if (!turn) return;
    const { releasedAt, marks } = turn;
    const ms = (m: Mark) =>
      marks[m] === undefined ? "n/a" : `${Math.round(marks[m] - releasedAt)}ms`;
    log(
      `[voice latency] ${ms("heard")} from end of speech to first AI audio` +
        ` (commit ${ms("commit")}, response.created ${ms("responseCreated")},` +
        ` first transcript ${ms("firstText")}, server audio start ${ms("serverAudio")})`,
    );
    turn = null;
  }

  return {
    release() {
      turn = { releasedAt: performance.now(), marks: {} };
    },
    mark(m) {
      if (!turn || turn.marks[m] !== undefined) return;
      turn.marks[m] = performance.now();
      if (m === "heard") flush();
    },
    cancel() {
      turn = null;
    },
    flush,
  };
}
