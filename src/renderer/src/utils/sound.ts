/**
 * Authentic Slack "Knock-Brush" notification sound synthesizer.
 * Recreates Slack's iconic double-knock pop notification sound using Web Audio API.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // --- First Knock (low percussive wood tap) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'triangle';
    // Rapid pitch drop from 340Hz to 140Hz creates authentic knock impact
    osc1.frequency.setValueAtTime(340, now);
    osc1.frequency.exponentialRampToValueAtTime(140, now + 0.045);

    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.05);

    // --- Second Knock ("Brush" higher pop, 70ms after first knock) ---
    const t2 = now + 0.07;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    // Pitch drop from 620Hz to 260Hz for the main brush tone
    osc2.frequency.setValueAtTime(620, t2);
    osc2.frequency.exponentialRampToValueAtTime(260, t2 + 0.065);

    gain2.gain.setValueAtTime(0.5, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.065);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(t2);
    osc2.stop(t2 + 0.07);

    // --- Subtle Slack high overtone chime (1240Hz) ---
    const t3 = t2 + 0.005;
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1240, t3);
    gain3.gain.setValueAtTime(0.15, t3);
    gain3.gain.exponentialRampToValueAtTime(0.001, t3 + 0.12);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc3.start(t3);
    osc3.stop(t3 + 0.12);

    // Clean up AudioContext after completion
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch (err) {
    console.error('Failed to play Slack sound', err);
  }
}
