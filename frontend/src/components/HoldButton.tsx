import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface HoldButtonProps {
  onHoldComplete: () => void;
  children: string;
  colors?: [string, string];
  textColor?: string;
  progressColor?: string;
  disabled?: boolean;
  style?: any;
  testID?: string;
}

export function HoldButton({
  onHoldComplete,
  children,
  colors = ["#F59E0B", "#FBBF24"],
  textColor = "#FFFFFF",
  progressColor = "#FFFFFF",
  disabled = false,
  style,
  testID,
}: HoldButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [isHolding, setIsHolding] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const startHold = () => {
    if (disabled) return;
    setIsHolding(true);
    setProgressPercent(0);

    // Start progress animation
    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });

    animationRef.current.start();

    // Set up timer for completion
    holdTimerRef.current = setTimeout(() => {
      onHoldComplete();
      resetHold();
    }, HOLD_DURATION);

    // Update progress display
    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 3.33; // 100% / 3 seconds ≈ 3.33% per 100ms
      });
    }, 100);

    // Store interval ID for cleanup
    (holdTimerRef as any).interval = interval;
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      if ((holdTimerRef.current as any).interval) {
        clearInterval((holdTimerRef.current as any).interval);
      }
    }
    if (animationRef.current) {
      animationRef.current.stop();
    }
    resetHold();
  };

  const resetHold = () => {
    setIsHolding(false);
    setProgressPercent(0);
    progress.setValue(0);
  };

  useEffect(() => {
    return () => {
      cancelHold();
    };
  }, []);

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Progress overlay */}
      <Animated.View
        style={[
          styles.progressOverlay,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: progressColor,
          },
        ]}
      />

      <View style={styles.content}>
        <Text style={[styles.text, { color: textColor }]}>
          {isHolding ? `${children}... ${Math.round(progressPercent)}%` : children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 52,
    alignItems: "center",
    borderRadius: 16,
    minWidth: 220,
    overflow: "hidden",
    shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  progressOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.25,
  },
  content: {
    alignItems: "center",
  },
  text: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
