// components/Route.tsx
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";


import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  TouchableOpacity,
  Modal,
} from "react-native";
//import { Route } from "expo-router";

interface RouteData {
  route: string;
  bound: string;
  service_type: string;
  orig_en: string;
  dest_en: string;
  orig_tc: string;
  dest_tc: string;
}

interface StopData {
  stop: string;
  seq: number;
  bound: string;
  service_type: string;
}

interface StopInfo {
  stop: string;
  name_tc: string;
  name_en: string;
  lat: number;
  long: number;
  seq: number[];
  eta?: string[]; // Added ETA field
}

interface FavoriteRoute {
  routeId: string;
  bound: string;
}


let count = 0;
export default function Route() {

  const [currentRouteForRefresh, setCurrentRouteForRefresh] =
    useState<RouteData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [stopsList, setStopsList] = useState<StopInfo[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);

  const toggleFavorite = async (routeId: string, bound: string) => {
    try {
      const exists = favorites.some((fav) => fav.routeId === routeId && fav.bound === bound);

      const updatedFavorites = exists
        ? favorites.filter((fav) => !(fav.routeId === routeId && fav.bound === bound)) // Remove if already in favorites
        : [...favorites, { routeId, bound }]; // Add to favorites

      setFavorites(updatedFavorites); // Update state first
      await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));

      console.log("Updated favorites:", updatedFavorites);
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  };


  useEffect(() => {
    fetchRoutes();
    loadFavorites();
  }, []);

  useEffect(() => {
    filterRoutes();
  }, [searchQuery, routes]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (currentRouteForRefresh && selectedRoute) {
      const direction = currentRouteForRefresh.bound === "O" ? "outbound" : "inbound";

      // Function to fetch and update ETAs sequentially
      const fetchAndUpdateETAs = async () => {
        try {
          // Fetch stop list
          const response = await fetch(
            `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${currentRouteForRefresh.route}/${direction}/${currentRouteForRefresh.service_type}`
          );
          const json = await response.json();

          if (json.data && Array.isArray(json.data)) {
            console.log("Fetched stop list successfully");
            await updateETAs(json.data, currentRouteForRefresh); // Process stops sequentially
          }
        } catch (error) {
          console.error("Error fetching route stops:", error);
        }
      };

      // Initial fetch
      fetchAndUpdateETAs();

      // Set up interval for updates
      intervalId = setInterval(fetchAndUpdateETAs, 20000); // 20 seconds
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentRouteForRefresh, selectedRoute]);


  const fetchRoutes = async () => {
    try {
      const response = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/route/");

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const json = await response.json();
      setRoutes(json.data);
      setFilteredRoutes(json.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching routes:", error);
      setLoading(false);
    }
  };


  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem("favorites");
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
        console.log("Loaded favorites:", JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  };




  const fetchStopsForRoute = async (route: RouteData) => {
    setLoadingStops(true);
    setCurrentRouteForRefresh(route); // Store the current route for refreshing
    try {
      const direction = route.bound === "O" ? "outbound" : "inbound";

      const routeStopsResponse = await fetch(
        `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route.route}/${direction}/${route.service_type}`
      );
      const routeStopsJson = await routeStopsResponse.json();

      if (!routeStopsJson.data || !Array.isArray(routeStopsJson.data)) {
        console.error("Invalid route stops data:", routeStopsJson);
        setStopsList([]);
        return;
      }

      const stops: StopData[] = routeStopsJson.data;

      await updateETAs(stops, route);
    } catch (error) {
      console.error("Error fetching stops:", error);
      setStopsList([]);
    } finally {
      setLoadingStops(false);
    }
  };

  const updateETAs = async (stops: StopData[], route: RouteData) => {
    let stopsInfo: any[] = [];

    for (const [index, stop] of stops.entries()) {
      try {
        // Fetch stop details
        const stopResponse = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/stop/${stop.stop}`
        );
        const stopJson = await stopResponse.json();

        // Fetch ETA for the stop
        const etaResponse = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stop.stop}/${route.route}/${route.service_type}`
        );
        const etaJson = await etaResponse.json();

        // Process ETA data
        const etaTimes = etaJson.data
          ? etaJson.data
            .filter((eta: any) => eta.seq === index + 1) // Ensure correct sequence
            .map((eta: any) => {
              const etaTime = new Date(eta.eta);
              const currentTime = new Date();
              const timeDiff = Math.round(
                (etaTime.getTime() - currentTime.getTime()) / 60000
              );
              return timeDiff > 0 ? `${timeDiff} mins` : "Arriving soon";
            })
          : [];

        stopsInfo.push({ ...stopJson.data, eta: etaTimes });

        console.log(`Fetched ETA for stop ${stop.stop} (${index + 1}/${stops.length})`);
      } catch (error) {
        console.error(`Error fetching stop ${stop.stop}:`, error);
      }
    }

    setStopsList(stopsInfo);
  };

  const filterRoutes = () => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      setFilteredRoutes(routes);
      return;
    }
    const filtered = routes.filter(
      (route) =>
        route.route.toLowerCase().includes(query) ||
        route.orig_en.toLowerCase().includes(query) ||
        route.dest_en.toLowerCase().includes(query) ||
        route.orig_tc.includes(query) ||
        route.dest_tc.includes(query)
    );
    setFilteredRoutes(filtered);
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search routes or bus stops..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  const renderItem = ({ item }: { item: RouteData }) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => {
        setSelectedRoute(item);
        fetchStopsForRoute(item);
      }}
    >
      <Text style={styles.routeNumber}> {item.route}</Text>
      <View style={styles.routeDetails}>
        <Text style={styles.routeText}>From: {item.orig_en}</Text>
        <Text style={styles.routeText}>To: {item.dest_en}</Text>

      </View>

      <TouchableOpacity onPress={() => toggleFavorite(item.route, item.bound)}>
        <MaterialIcons
          name={favorites.some((fav) => fav.routeId === item.route && fav.bound === item.bound) ? "star" : "star-border"}
          size={24}
          style={styles.icons}
          color={favorites.some((fav) => fav.routeId === item.route && fav.bound === item.bound) ? "gold" : "gray"}
        />

      </TouchableOpacity>

    </TouchableOpacity>
  );


  const renderStopsList = () => {
    if (!selectedRoute) return null;

    return (
      <Modal
        visible={!!selectedRoute}
        animationType="slide"
        onRequestClose={() => {
          setSelectedRoute(null);
          setCurrentRouteForRefresh(null); // Clear the refresh state
          setStopsList([]);
        }}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRoute(null);
                setCurrentRouteForRefresh(null); // Clear the refresh state
                setStopsList([]);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedRoute.route} To
              {selectedRoute.dest_en}
            </Text>
          </View>

          {loadingStops ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : stopsList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No stops found for route {selectedRoute.route} (
                {selectedRoute.bound === "O" ? "Outbound" : "Inbound"}).
              </Text>
            </View>
          ) : (
            <FlatList
              data={stopsList}
              keyExtractor={(item, index) => `${item.stop}-${index}`}
              renderItem={({ item, index }) => (
                <View style={styles.stopItem}>
                  <Text style={styles.stopNumber}>Stop {index + 1}</Text>
                  <Text style={styles.stopName}>{item.name_en}</Text>
                  <Text style={styles.stopNameChinese}>{item.name_tc}</Text>
                  {item.eta && item.eta.length > 0 ? (
                    <Text style={styles.etaText}>
                      ETA: {item.eta.join(", ")}
                    </Text>
                  ) : (
                    <Text style={styles.etaText}>ETA: N/A</Text>
                  )}
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No routes found matching "{searchQuery}"
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderSearchBar()}
        <FlatList
          data={filteredRoutes}
          renderItem={renderItem}
          keyExtractor={(item) =>
            `${item.route}-${item.bound}-${item.service_type}`
          }
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmpty}
        />

        {renderStopsList()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  icons: {
    right: 10
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  routeNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    width: 40, // Fixed width to align properly
    textAlign: "center",
  },
  etaText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#007AFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    // Add padding top for Android
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },

  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 8,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    // Remove any top margin or padding that might cause spacing issues
    zIndex: 1, // Ensure search bar stays on top
  },
  searchInput: {
    height: 40,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  routeDetails: {
    gap: 4,
  },
  routeText: {
    fontSize: 16,
    color: "#34495e",
  },
  directionText: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 4,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#007AFF",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 16,
  },
  stopItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
  },
  stopNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  stopName: {
    fontSize: 16,
    color: "#34495e",
    marginTop: 4,
  },

  stopNameChinese: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 2,
  },
});
