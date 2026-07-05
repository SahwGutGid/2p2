import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  surface: "#FDFBF7",
  surfaceSecondary: "#FFFFFF",
  onSurface: "#121F17",
  brand: "#00C853",
  brandDeep: "#00701A",
  brandTertiary: "#C8E6C9",
  border: "#E0E0E0",
  disabled: "#9E9E9E",
  onBrand: "#FFFFFF",
};

const INVEST_DURATION_MS = 5000;
const RETURN_MULTIPLIER = 1.1;
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1669951584309-492ed24d274f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwyfHwzZCUyMGNvaW4lMjBtb25leSUyMGJ1c2luZXNzfGVufDB8fHx8MTc4MzI1MDU4OHww&ixlib=rb-4.1.0&q=85";

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function Index() {
  const [money, setMoney] = useState<number>(100);
  const [isInvesting, setIsInvesting] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [lastProfit, setLastProfit] = useState<number>(0);

  const progress = useSharedValue(0); // 0 -> 1 across 5s
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);
  const balanceScale = useSharedValue(1);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (finishRef.current) clearTimeout(finishRef.current);
      cancelAnimation(progress);
    };
  }, [progress]);

  const finishInvestment = (principal: number) => {
    const newBalance = principal * RETURN_MULTIPLIER;
    const profit = newBalance - principal;
    setMoney(newBalance);
    setLastProfit(profit);
    setIsInvesting(false);
    setSecondsLeft(0);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );

    // pop balance
    balanceScale.value = withSequence(
      withTiming(1.12, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) })
    );

    // floating +$X
    floatY.value = 0;
    floatOpacity.value = 1;
    floatY.value = withTiming(-80, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    floatOpacity.value = withDelay(
      600,
      withTiming(0, { duration: 600, easing: Easing.linear })
    );

    progress.value = 0;
  };

  const handleInvest = () => {
    if (isInvesting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const principal = money;
    setIsInvesting(true);
    setSecondsLeft(5);

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: INVEST_DURATION_MS,
      easing: Easing.linear,
    });

    // countdown ticker (visual seconds)
    let remaining = 5;
    tickRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        setSecondsLeft(0);
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    finishRef.current = setTimeout(() => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      finishInvestment(principal);
    }, INVEST_DURATION_MS);
  };

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const floatingStyle = useAnimatedStyle(() => ({
    opacity: floatOpacity.value,
    transform: [{ translateY: floatY.value }],
  }));

  const balanceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: balanceScale.value }],
  }));

  const projectedReturn = money * RETURN_MULTIPLIER;
  const projectedProfit = projectedReturn - money;

  return (
    <SafeAreaView style={styles.safe} testID="game-screen">
      <View style={styles.container}>
        {/* Hero */}
        <View style={styles.heroWrap} testID="hero-image-wrap">
          <Image
            source={{ uri: HERO_IMAGE }}
            style={styles.hero}
            contentFit="cover"
            transition={300}
          />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard} testID="balance-card">
          <Text style={styles.balanceLabel}>Current Balance</Text>

          <View style={styles.balanceRow}>
            <Animated.Text
              style={[styles.balanceValue, balanceAnimStyle]}
              testID="balance-value"
            >
              {formatMoney(money)}
            </Animated.Text>

            <Animated.Text
              style={[styles.floatingProfit, floatingStyle]}
              pointerEvents="none"
              testID="floating-profit"
            >
              +{formatMoney(lastProfit)}
            </Animated.Text>
          </View>

          <View style={styles.badge} testID="return-badge">
            <Text style={styles.badgeText}>+10% Return / 5s</Text>
          </View>

          <View style={styles.projectionRow}>
            <View style={styles.projectionCell}>
              <Text style={styles.projectionLabel}>Next Profit</Text>
              <Text style={styles.projectionValue} testID="projected-profit">
                +{formatMoney(projectedProfit)}
              </Text>
            </View>
            <View style={styles.projectionDivider} />
            <View style={styles.projectionCell}>
              <Text style={styles.projectionLabel}>Next Balance</Text>
              <Text style={styles.projectionValue} testID="projected-balance">
                {formatMoney(projectedReturn)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Invest button */}
        <Pressable
          onPress={handleInvest}
          disabled={isInvesting}
          style={({ pressed }) => [
            styles.investButton,
            isInvesting && styles.investButtonBusy,
            pressed && !isInvesting && styles.investButtonPressed,
          ]}
          testID="invest-button"
        >
          {/* animated progress fill */}
          <Animated.View
            style={[styles.investProgress, progressStyle]}
            pointerEvents="none"
            testID="invest-progress"
          />
          <Text style={styles.investLabel} testID="invest-label">
            {isInvesting ? `Investing... ${secondsLeft}s` : "Invest"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  heroWrap: {
    height: 180,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.brandTertiary,
    marginBottom: 24,
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  balanceCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.onSurface,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 8,
  },
  balanceRow: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceValue: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -1.5,
  },
  floatingProfit: {
    position: "absolute",
    top: 0,
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.brand,
  },
  badge: {
    marginTop: 12,
    backgroundColor: COLORS.brandTertiary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.brandDeep,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  projectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: "100%",
  },
  projectionCell: {
    flex: 1,
    alignItems: "center",
  },
  projectionDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  projectionLabel: {
    fontSize: 12,
    color: COLORS.onSurface,
    opacity: 0.6,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  projectionValue: {
    fontSize: 18,
    color: COLORS.onSurface,
    fontWeight: "900",
  },
  investButton: {
    height: 72,
    borderRadius: 999,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  investButtonPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.2,
  },
  investButtonBusy: {
    backgroundColor: COLORS.brandDeep,
  },
  investProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  investLabel: {
    color: COLORS.onBrand,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
