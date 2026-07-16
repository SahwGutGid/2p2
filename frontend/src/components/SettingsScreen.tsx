import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  settings: {
    music: boolean;
    sfx: boolean;
    haptics: boolean;
    notifications: boolean;
    holdToPrestige: boolean;
    autoReinvest: boolean;
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
  overlay: "rgba(0,0,0,0.6)",
};

export function SettingsScreen({
  visible,
  onClose,
  settings,
  onSettingChange,
}: SettingsScreenProps) {
  const SettingToggle = ({
    label,
    description,
    value,
    onToggle,
  }: {
    label: string;
    description?: string;
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
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalWrapper} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={[C.bg, "#1E293B", C.bg]}
            style={styles.modalCard}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <Text style={styles.headerTitle}>SETTINGS</Text>
              <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              indicatorStyle="white"
            >
              {/* Branding */}
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

              {/* Preferences */}
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

              {/* Gameplay */}
              <View style={styles.settingsCard}>
                <Text style={styles.sectionTitle}>GAMEPLAY</Text>

                <SettingToggle
                  label="Auto Reinvest"
                  description="Automatically restart completed investments when funds are available. Requires Automated Reinvestment skill."
                  value={settings.autoReinvest}
                  onToggle={() => onSettingChange("autoReinvest", !settings.autoReinvest)}
                />

                <SettingToggle
                  label="Hold to Prestige"
                  description="Requires holding the button to confirm prestige. Turn off for instant tap."
                  value={settings.holdToPrestige}
                  onToggle={() => onSettingChange("holdToPrestige", !settings.holdToPrestige)}
                />
              </View>

              {/* Version */}
              <View style={styles.versionCard}>
                <Text style={styles.versionLabel}>Version</Text>
                <Text style={styles.versionValue}>1.0.0</Text>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <ExpoImage
                  source={require("@/assets/images/22.png")}
                  style={styles.footerLogo}
                  contentFit="contain"
                />
                <Text style={styles.footerText}>p2p.com.mk</Text>
              </View>
            </ScrollView>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalWrapper: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "85%",
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerSpacer: { width: 36 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: C.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textMuted,
  },
  scrollView: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  brandingCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  brandingLogo: {
    width: 120,
    height: 60,
  },
  brandingDivider: {
    width: 36,
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  brandingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  brandingSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: C.textMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  brandingWebsite: {
    fontSize: 13,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 12,
    textTransform: "uppercase",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  settingRowPressed: {
    opacity: 0.7,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: C.text,
  },
  settingDescription: {
    fontSize: 11,
    fontWeight: "400",
    color: C.textMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.textMuted,
  },
  toggleDotOn: {
    backgroundColor: C.white,
    marginLeft: "auto",
  },
  versionCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: C.textMuted,
  },
  versionValue: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  footer: {
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  footerLogo: {
    width: 64,
    height: 32,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.5,
  },
});
