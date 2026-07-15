import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 35, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(100),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]);

    seq.start(() => {
      setTimeout(() => onComplete?.(), 900);
    });

    return () => seq.stop();
  }, [onComplete]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#071426", "#0F1F38", "#071426"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Radial glow */}
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
        <Animated.View style={[styles.glowInner, { opacity: glowOpacity }]} />

        {/* P2P Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require("@/assets/images/22.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
          <Text style={styles.tagline}>INVESTMENT IDLE</Text>
        </Animated.View>

        {/* Powered by */}
        <Animated.View style={[styles.footerContainer, { opacity: subtitleOpacity }]}>
          <View style={styles.footerDivider} />
          <Text style={styles.poweredBy}>Powered by</Text>
          <Text style={styles.website}>p2p.com.mk</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071426",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  glowInner: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  logoContainer: {
    marginBottom: 28,
    padding: 8,
  },
  logo: {
    width: 160,
    height: 80,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 0,
  },
  tagline: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  footerContainer: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
  },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    marginBottom: 12,
  },
  poweredBy: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  website: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 0.5,
  },
});
