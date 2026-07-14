import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
  delay: number;
}

interface FinalUpgradeCelebrationProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export function FinalUpgradeCelebration({
  visible,
  onAnimationComplete,
}: FinalUpgradeCelebrationProps) {
  const trophyScale = useRef(new Animated.Value(0)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;
  const particlesRef = useRef<Particle[]>([]);
  const particleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Initialize particles
  if (particlesRef.current.length === 0) {
    const colors = ["#FFD700", "#F59E0B", "#A855F7", "#3B82F6", "#FFFFFF"];
    for (let i = 0; i < 30; i++) {
      particlesRef.current.push({
        x: new Animated.Value(width / 2),
        y: new Animated.Value(height / 2),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        rotation: new Animated.Value(0),
        color: colors[i % colors.length],
        size: 4 + Math.random() * 8,
        delay: Math.random() * 1000,
      });
    }
  }

  useEffect(() => {
    if (visible) {
      // Trophy entrance animation
      Animated.parallel([
        Animated.spring(trophyScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
        Animated.timing(trophyOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();

      // Glow animation
      Animated.timing(glowOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();

      // Particle animations
      const particleAnims = particlesRef.current.map((p) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 150;
        const endX = width / 2 + Math.cos(angle) * distance;
        const endY = height / 2 + Math.sin(angle) * distance;
        const duration = 1500 + Math.random() * 1000;
        
        return Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.x, { toValue: endX, duration, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: endY, duration, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(p.rotation, { toValue: 360, duration, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(duration * 0.6),
              Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.4, useNativeDriver: true }),
            ]),
          ]),
        ]);
      });
      
      particleAnimRef.current = Animated.parallel(particleAnims);
      particleAnimRef.current.start();

      // Text animation
      const textAnim = setTimeout(() => {
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(textSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      }, 300);

      // Auto-dismiss after 3 seconds
      const dismissAnim = setTimeout(() => {
        Animated.parallel([
          Animated.timing(trophyOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          onAnimationComplete?.();
        });
      }, 3000);

      return () => {
        clearTimeout(textAnim);
        clearTimeout(dismissAnim);
        particleAnimRef.current?.stop();
      };
    } else {
      // Reset animations
      trophyScale.setValue(0);
      trophyOpacity.setValue(0);
      glowOpacity.setValue(0);
      textOpacity.setValue(0);
      textSlide.setValue(20);
      particlesRef.current.forEach(p => {
        p.x.setValue(width / 2);
        p.y.setValue(height / 2);
        p.scale.setValue(0);
        p.opacity.setValue(1);
        p.rotation.setValue(0);
      });
    }
  }, [visible, onAnimationComplete]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Particles */}
      {particlesRef.current.map((p, i) => (
        <Animated.View
          key={`particle-${i}`}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { scale: p.scale },
              { rotate: p.rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) },
            ],
          }}
        />
      ))}
      
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      
      <Animated.View
        style={[
          styles.trophyContainer,
          {
            opacity: trophyOpacity,
            transform: [{ scale: trophyScale }],
          },
        ]}
      >
        <LinearGradient
          colors={["#FFD700", "#F59E0B", "#FFD700"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.trophyGradient}
        >
          <Text style={styles.trophyIcon}>🏆</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textSlide }],
          },
        ]}
      >
        <Text style={styles.title}>ULTIMATE UPGRADE</Text>
        <Text style={styles.subtitle}>The Ultimate Investor</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 215, 0, 0.3)",
    shadowColor: "#FFD700",
    shadowOpacity: 0.8,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  trophyContainer: {
    marginBottom: 24,
  },
  trophyGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  trophyIcon: {
    fontSize: 64,
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
    textShadowColor: "rgba(255, 215, 0, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
});
