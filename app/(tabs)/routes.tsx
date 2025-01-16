// app/(tabs)/routes.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Route from '@/components/Route';

export default function RouteScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Route />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
