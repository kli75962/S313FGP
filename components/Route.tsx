// components/Route.tsx
import React, { useEffect, useState } from "react";
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
  TouchableOpacity, // Add this
  Modal, // Add this too
} from "react-native";

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
}

export default function Route() {
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [stopsList, setStopsList] = useState<StopInfo[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Filter routes when search query changes
  useEffect(() => {
    filterRoutes();
  }, [searchQuery, routes]);

  const fetchRoutes = async () => {
    try {
      const response = await fetch(
        "https://data.etabus.gov.hk/v1/transport/kmb/route/"
      );
      const json = await response.json();
      setRoutes(json.data);
      setFilteredRoutes(json.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching routes:", error);
      setLoading(false);
    }
  };

  const fetchStopsForRoute = async (route: RouteData) => {
    setLoadingStops(true);
    try {
      // Convert outbound/inbound to O/I
      const direction = route.bound === "O" ? "outbound" : "inbound";
      console.log(
        "Direction for API:",
        route.route,
        direction,
        route.service_type
      );

      // First fetch route stops
      const routeStopsResponse = await fetch(
        `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route.route}/${direction}/${route.service_type}`
      );
      const routeStopsJson = await routeStopsResponse.json();

      if (routeStopsJson.code === 422) {
        console.error("API Error:", routeStopsJson.message);
        setStopsList([]);
        return;
      }

      // Add validation to check if data exists and is an array
      if (!routeStopsJson.data || !Array.isArray(routeStopsJson.data)) {
        console.error("Invalid route stops data:", routeStopsJson);
        setStopsList([]);
        return;
      }

      const stops: StopData[] = routeStopsJson.data;

      // Then fetch details for each stop
      const stopsPromises = stops.map(async (stop) => {
        try {
          const stopResponse = await fetch(
            `https://data.etabus.gov.hk/v1/transport/kmb/stop/${stop.stop}`
          );
          const stopJson = await stopResponse.json();
          return stopJson.data;
        } catch (error) {
          console.error(`Error fetching stop ${stop.stop}:`, error);
          return null;
        }
      });

      const stopsInfo = (await Promise.all(stopsPromises)).filter(
        (stop) => stop !== null
      );
      setStopsList(stopsInfo);
    } catch (error) {
      console.error("Error fetching stops:", error);
      setStopsList([]);
    } finally {
      setLoadingStops(false);
    }
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
      <Text style={styles.routeNumber}>Route {item.route}</Text>
      <View style={styles.routeDetails}>
        <Text style={styles.routeText}>From: {item.orig_en}</Text>
        <Text style={styles.routeText}>To: {item.dest_en}</Text>
        <Text style={styles.directionText}>
          Direction: {item.bound === "O" ? "Outbound" : "Inbound"}
        </Text>
      </View>
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
          setStopsList([]);
        }}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRoute(null);
                setStopsList([]);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Route {selectedRoute.route} Stops -{" "}
              {selectedRoute.bound === "O" ? "Outbound" : "Inbound"}
            </Text>
          </View>

          {loadingStops ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : stopsList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No stops found for route {selectedRoute.route} (
                {selectedRoute.bound === "O" ? "Outbound" : "Inbound"}).
                {"\n\n"}
                This could be because the route doesn't operate in this
                direction or there was an error loading the data.
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
  routeItem: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  routeNumber: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#2c3e50",
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
