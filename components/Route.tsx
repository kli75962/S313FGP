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
  TouchableOpacity,
  Modal,
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
  eta?: string[]; // Added ETA field
}

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

  useEffect(() => {
    fetchRoutes();
  }, []);

  useEffect(() => {
    filterRoutes();
  }, [searchQuery, routes]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (currentRouteForRefresh && selectedRoute) {
      // Initial fetch
      const direction =
        currentRouteForRefresh.bound === "O" ? "outbound" : "inbound";
      fetch(
        `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${currentRouteForRefresh.route}/${direction}/${currentRouteForRefresh.service_type}`
      )
        .then((response) => response.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            updateETAs(json.data, currentRouteForRefresh);
          }
        });

      // Set up interval for updates
      intervalId = setInterval(() => {
        fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${currentRouteForRefresh.route}/${direction}/${currentRouteForRefresh.service_type}`
        )
          .then((response) => response.json())
          .then((json) => {
            if (json.data && Array.isArray(json.data)) {
              updateETAs(json.data, currentRouteForRefresh);
            }
          });
      }, 20000); // 20 seconds
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
    const stopsPromises = stops.map(async (stop) => {
      try {
        const stopResponse = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/stop/${stop.stop}`
        );
        const stopJson = await stopResponse.json();

        const etaResponse = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stop.stop}/${route.route}/${route.service_type}`
        );
        const etaJson = await etaResponse.json();

        const etaTimes = etaJson.data
          ? etaJson.data.slice(0, 3).map((eta: any) => {
              const etaTime = new Date(eta.eta);
              const currentTime = new Date();
              const timeDiff = Math.round(
                (etaTime.getTime() - currentTime.getTime()) / 60000
              );
              return timeDiff > 0 ? `${timeDiff} mins` : "Arriving soon";
            })
          : [];

        return { ...stopJson.data, eta: etaTimes };
      } catch (error) {
        console.error(`Error fetching stop ${stop.stop}:`, error);
        return null;
      }
    });

    const stopsInfo = (await Promise.all(stopsPromises)).filter(
      (stop) => stop !== null
    );
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
  etaText: {
    fontSize: 14,
    color: "#e67e22",
    marginTop: 4,
  },
  stopNameChinese: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 2,
  },
});
