// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Mobile App — Placeholder
// Phase 7 — do not build until web platform is stable.
// ─────────────────────────────────────────────────────────────────────────────

import { View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HomeReach</Text>
      <Text style={styles.subtitle}>Mobile app — coming soon</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#6b7280",
  },
});
