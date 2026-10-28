// listens to the interviewer's incoming audio and fires once it actually gets loud.
// that's the moment you *hear* the reply, which is what latency should measure

// rms of about -40 dBFS: above line noise, below any real speech
const ONSET_RMS = 0.01;
const POLL_MS = 10;

export type OnsetDetector = {
  attach: (stream: MediaStream) => void;
  arm: (onOnset: () => void) => void;
  disarm: () => void;
  close: () => void;
};

export function createOnsetDetector(ctx: AudioContext): OnsetDetector {
  let source: MediaStreamAudioSourceNode | null = null;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const buf = new Float32Array(analyser.fftSize);
  let timer: ReturnType<typeof setInterval> | null = null;

  function disarm() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    attach(stream) {
      source?.disconnect();
      // analysis only, never routed to speakers; the <audio> element does the playing
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
    },
    // only polls between a turn ending and the reply arriving, so it's not burning cpu all call
    arm(onOnset) {
      disarm();
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        if (Math.sqrt(sum / buf.length) > ONSET_RMS) {
          disarm();
          onOnset();
        }
      }, POLL_MS);
    },
    disarm,
    close() {
      disarm();
      source?.disconnect();
      source = null;
    },
  };
}
