// app/(tabs)/Wishlists.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Wishlist from '@/components/Wishlist';

export default function WishlistScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Wishlist />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
