// Background music hook — loops a single track, starts on first user interaction
// (browser autoplay rules), pauses on background/inactive, resumes on foreground.

import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioSource } from "expo-audio";

const TRACK: AudioSource = {
  uri: "https://customer-assets.emergentagent.com/job_money-clicker-22/artifacts/5bdhovtp_cosy%20-%20lofi%20type%20beat%20%28FREE%20FOR%20PROFIT%20USE%29%20-%20Prod.%20Riddiman.mp3",
};

const DEFAULT_VOLUME = 0.35;

export function useBackgroundMusic(enabled: boolean, volume: number = DEFAULT_VOLUME) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Preload player
  useEffect(() => {
    let cancelled = false;
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
    try {
      const p = createAudioPlayer(TRACK);
      p.loop = true;
      p.volume = volume;
      if (!cancelled) {
        playerRef.current = p;
        setReady(true);
      }
    } catch {}
    return () => {
      cancelled = true;
      try { playerRef.current?.remove(); } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to enable toggle
  useEffect(() => {
    if (!ready) return;
    const p = playerRef.current;
    if (!p) return;
    try {
      if (enabled && startedRef.current) {
        p.play();
      } else {
        p.pause();
      }
    } catch {}
  }, [enabled, ready]);

  // Volume changes
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try { p.volume = volume; } catch {}
  }, [volume]);

  // Pause when backgrounded, resume when foregrounded (if enabled)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const p = playerRef.current;
      if (!p) return;
      try {
        if (state === "active" && enabled && startedRef.current) p.play();
        else p.pause();
      } catch {}
    });
    return () => sub.remove();
  }, [enabled]);

  return {
    // Call after any user interaction to satisfy autoplay policies.
    kick() {
      if (startedRef.current) return;
      const p = playerRef.current;
      if (!p) return;
      startedRef.current = true;
      if (!enabled) return;
      try {
        p.seekTo(0);
        p.play();
      } catch {}
    },
  };
}
