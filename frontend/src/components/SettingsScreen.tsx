import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  settings: {
    music: boolean;
    sfx: boolean;
    haptics: boolean;
    notifications: boolean;
  };
  onSettingChange: (key: string, value: boolean) => void;
}

const C = {
  bg: "#0F172A",
  card: "#1E293B",
  accent: "#F59E0B",
  success: "#00C896",
  white: "#FFFFFF",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  border: "#334155",
};

export function SettingsScreen({
  visible,
  onClose,
  settings,
  onSettingChange,
}: SettingsScreenProps) {
  if (!visible) return null;

  const SettingToggle = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && styles.settingRowPressed,
      ]}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <LinearGradient
        colors={[C.bg, "#1E293B", C.bg]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16} style={styles.backButton}>
          <Text style={styles.backButtonText}>← BACK</Text>
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Official P2P Branding Card */}
        <View style={styles.brandingCard}>
          <ExpoImage
            source={require("@/assets/images/22.png")}
            style={styles.brandingLogo}
            contentFit="contain"
          />
          <View style={styles.brandingDivider} />
          <Text style={styles.brandingTitle}>Investment Idle</Text>
          <Text style={styles.brandingSubtitle}>An Official P2P Experience</Text>
          <Text style={styles.brandingWebsite}>p2p.com.mk</Text>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <SettingToggle
            label="Music"
            value={settings.music}
            onToggle={() => onSettingChange("music", !settings.music)}
          />
          
          <SettingToggle
            label="Sound Effects"
            value={settings.sfx}
            onToggle={() => onSettingChange("sfx", !settings.sfx)}
          />
          
          <SettingToggle
            label="Haptics"
            value={settings.haptics}
            onToggle={() => onSettingChange("haptics", !settings.haptics)}
          />
          
          <SettingToggle
            label="Notifications"
            value={settings.notifications}
            onToggle={() => onSettingChange("notifications", !settings.notifications)}
          />
        </View>

        {/* Version Info */}
        <View style={styles.versionCard}>
          <Text style={styles.versionLabel}>Version</Text>
          <Text style={styles.versionValue}>1.0.0</Text>
        </View>

        {/* Footer Branding */}
        <View style={styles.footer}>
          <ExpoImage
            source={require("@/assets/images/22.png")}
            style={styles.footerLogo}
            contentFit="contain"
          />
          <Text style={styles.footerText}>p2p.com.mk</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: C.accent,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: C.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  brandingCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brandingLogo: {
    width: 120,
    height: 60,
    marginBottom: 0,
  },
  brandingDivider: {
    width: 40,
    height: 1,
    backgroundColor: C.border,
    marginVertical: 16,
  },
  brandingTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  brandingSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: C.textMuted,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  brandingWebsite: {
    fontSize: 14,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  settingRowPressed: {
    opacity: 0.7,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: C.text,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: C.border,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: C.success,
    borderColor: C.success,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.textMuted,
  },
  toggleDotOn: {
    backgroundColor: C.white,
    marginLeft: "auto",
  },
  versionCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: C.textMuted,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
  },
  footer: {
    alignItems: "center",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  footerLogo: {
    width: 72,
    height: 36,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.5,
  },
});
