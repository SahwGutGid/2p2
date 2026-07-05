# Investment Idle — PRD

## Overview
A single-screen incremental investment game prototype (React Native / Expo). Originally requested as an Android Kotlin app; user chose to build it as an Expo mobile app instead so it runs live in Expo Go.

## Core Rules
- Player starts with **$100.00**.
- One primary action: **Invest** button.
- Tapping Invest starts a **5-second timer** during which the button is disabled and shows a live countdown + progress fill.
- After 5 seconds, balance becomes `balance * 1.10` (**+10% profit**).
- Balance is shown on screen and updates live (with a pop + floating "+$X" animation).

## Screen (single)
- Hero image (3D coins) at top.
- Balance card: `CURRENT BALANCE` label + huge balance value + `+10% Return / 5s` badge + Next Profit / Next Balance projection row.
- Sticky pill-shaped **Invest** button at the bottom with an animated progress fill.

## Interactions
- `onInvestPress` → `Haptics.ImpactFeedbackStyle.Medium`.
- `onCycleComplete` → `Haptics.NotificationFeedbackType.Success`, balance pop scale animation, floating `+$X` upward fade.

## Design
See `/app/design_guidelines.json`. Personality: Tactile / Playful (LIGHT). Brand `#00C853`.

## Tech
- Expo Router (single `app/index.tsx` route).
- `react-native-reanimated` for progress bar, floating profit, balance pop.
- `expo-haptics` for feedback.
- `expo-image` for the hero.
- No backend, no persistence — pure client-side prototype as specified.

## Non-goals
- No auth, no MongoDB, no multiplayer, no persistence between app restarts.
