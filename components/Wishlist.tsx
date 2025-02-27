// components/Wishlist.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

interface FavoriteRoute {
  routeId: string;
  bound: string;
}

export default function Wishlist() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem("favorites");
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  };

  const removeFavorite = async (routeId: string, bound: string) => {
    const updatedFavorites = favorites.filter((fav) => !(fav.routeId === routeId && fav.bound === bound));
    setFavorites(updatedFavorites);
    await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
  };

  const renderItem = ({ item }: { item: FavoriteRoute }) => (
    <View style={styles.routeItem}>
      <Text style={styles.routeText}>Route {item.routeId} ({item.bound === "O" ? "Outbound" : "Inbound"})</Text>
      <TouchableOpacity onPress={() => removeFavorite(item.routeId, item.bound)}>
        <MaterialIcons name="delete" size={24} color="red" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Favorite Routes</Text>
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.routeId}-${item.bound}`}
        ListEmptyComponent={<Text style={styles.emptyText}>No favorites added.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  routeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  routeText: {
    fontSize: 18,
    color: "#34495e",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
});
