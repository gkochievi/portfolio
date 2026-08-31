let audioCtx = null;

function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(frequency, duration, { delay = 0, type = 'sine', volume = 0.18 } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playNotificationSound(kind = 'info') {
  try {
    if (kind === 'newOrder' || kind === 'alert') {
      // two-tone rising chime
      playTone(660, 0.18, { delay: 0, volume: 0.2 });
      playTone(880, 0.22, { delay: 0.14, volume: 0.22 });
    } else if (kind === 'status') {
      playTone(520, 0.14, { delay: 0, volume: 0.16 });
      playTone(700, 0.18, { delay: 0.11, volume: 0.18 });
    } else {
      playTone(600, 0.16, { delay: 0, volume: 0.16 });
    }
  } catch {
    // audio may be disallowed until user interaction; silently ignore
  }
}

export function primeAudio() {
  // must be called from a user gesture to satisfy browser autoplay policies
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
