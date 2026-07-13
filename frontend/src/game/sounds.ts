// Lightweight sound engine for the incremental investment game.
// - Uses expo-audio's imperative createAudioPlayer for lowest overhead.
// - All calls are safe: if a player fails to load, `play(event)` becomes a no-op.
// - Reusable: preloads once at mount, replays by rewinding (seekTo 0).

import { useEffect, useMemo, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioSource } from "expo-audio";

export type SoundEvent =
  | "click"
  | "investStart"
  | "investComplete"
  | "upgrade"
  | "error"
  | "victory";

// Short, permissive CC0-ish preview clips from mixkit's public asset CDN.
// Structure is what matters — swap URLs with bundled assets any time.
const SOURCES: Record<SoundEvent, AudioSource> = {
  click: { uri: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" },
  investStart: { uri: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3" },
  investComplete: { uri: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" },
  upgrade: { uri: "https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3" },
  error: { uri: "https://assets.mixkit.co/active_storage/sfx/952/952-preview.mp3" },
  victory: { uri: "https://assets.mixkit.co/active_storage/sfx/2008/2008-preview.mp3" },
};

// Rough per-event volume so effects don't overpower each other.
const VOLUMES: Record<SoundEvent, number> = {
  click: 0.35,
  investStart: 0.55,
  investComplete: 0.7,
  upgrade: 0.55,
  error: 0.5,
  victory: 0.8,
};

export function useSoundEngine() {
  // Keep player instances alive across re-renders.
  const playersRef = useRef<Partial<Record<SoundEvent, ReturnType<typeof createAudioPlayer>>>>({});

  useEffect(() => {
    let cancelled = false;

    // Enable playback even when device is on silent mode (mobile).
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});

    // Preload every event's player.
    (Object.keys(SOURCES) as SoundEvent[]).forEach((event) => {
      try {
        const player = createAudioPlayer(SOURCES[event]);
        player.volume = VOLUMES[event];
        if (!cancelled) playersRef.current[event] = player;
      } catch {
        // Missing asset — leave undefined so play() will no-op.
      }
    });

    return () => {
      cancelled = true;
      Object.values(playersRef.current).forEach((p) => {
        try {
          p?.remove();
        } catch {}
      });
      playersRef.current = {};
    };
  }, []);

  return useMemo(
    () => ({
      play(event: SoundEvent) {
        const player = playersRef.current[event];
        if (!player) return;
        try {
          // Rewind and play — cheap replay.
          player.seekTo(0);
          player.play();
        } catch {
          // Silently swallow — sound is nice-to-have, never blocking.
        }
      },
    }),
    []
  );
}
