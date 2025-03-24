// app/(tabs)/routes.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import SettingPage from '@/components/SettingPage';

export default function RouteScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <SettingPage />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
