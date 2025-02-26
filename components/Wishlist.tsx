// app/(tabs)/Wishlist_layouts.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Wishlist_layout from '@/components/Wishlist';

export default function Wishlist_layoutScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Wishlist_layout />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
