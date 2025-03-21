// components/Route.tsx
import React, { useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useColorScheme } from 'react-native';
import { Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

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
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

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
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(-1);

  // Add a ref for the WebView
  const webViewRef = useRef<WebView>(null);

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
        placeholderTextColor={isDarkMode ? '#fff' : '#999'}
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
      <View style={[styles.routeDetails, { flex: 1 }]}>
        <Text style={styles.routeText}>From: {item.orig_en}</Text>
        <Text style={styles.routeText}>To: {item.dest_en}</Text>

      </View>

      <TouchableOpacity
        onPress={() => toggleFavorite(item.route, item.bound)}
        style={{ marginLeft: 'auto', padding: 8 }}
      >
        <MaterialIcons
          name={favorites.some((fav) => fav.routeId === item.route && fav.bound === item.bound) ? "star" : "star-border"}
          size={24}
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
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
              {selectedRoute.route} To 
              {selectedRoute.dest_en}
            </Text>
          </View>

          {renderMapView()}

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
                <TouchableOpacity
                  style={styles.stopItem}
                  onPress={() => handleSelectStop(index)}
                >
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
                </TouchableOpacity>
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

  // Function to create HTML content for the map
  const createLeafletHTML = () => {
    if (!selectedRoute) return '';

    // Update the initialCenter calculation to handle empty stopsList
    const initialCenter = stopsList.length > 0 ?
      `[${stopsList[0].lat}, ${stopsList[0].long}]` :
      '[0, 0]'; // Default to [0, 0] if stopsList is empty

    // Ensure stopsData is only created if stopsList is not empty
    const stopsData = stopsList.length > 0 ? JSON.stringify(stopsList.map((stop, index) => ({
      location: { lat: stop.lat, lng: stop.long },
      name: { en: stop.name_en, tc: stop.name_tc },
      eta: stop.eta || []
    }))) : '[]';

    const routeCoords = stopsList.map(stop => [stop.lat, stop.long]);

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      #map {
        height: 100%;
        width: 100%;
      }
      .custom-marker {
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background-color: #2196F3;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      }
      .custom-marker.active {
        background-color: #f44336;
        width: 36px;
        height: 36px;
        z-index: 1000;
      }
      .custom-marker.passed {
        background-color: #9e9e9e;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      // Function to initialize the map
      function initMap() {
        try {
          const map = L.map('map').setView(${initialCenter}, 15);
          
          // Add tile layer (base map)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);
          
          // Add stops data
          const stops = ${stopsData};
          const selectedStopIndex = ${selectedStopIndex};
          
          // Create a polyline for the route
          const routeCoords = ${JSON.stringify(routeCoords)};
          const routeLine = L.polyline(routeCoords, {
            color: '#2E86C1',
            weight: 4
          }).addTo(map);
          
          // Add markers for each stop
          stops.forEach((stop, index) => {
            // Create custom marker element
            const markerEl = document.createElement('div');
            markerEl.className = 'custom-marker';
            if (index === selectedStopIndex) {
              markerEl.classList.add('active');
            }
            if (index < selectedStopIndex) {
              markerEl.classList.add('passed');
            }
            markerEl.innerText = (index + 1).toString();
            
            // Create marker with custom icon
            const marker = L.marker([stop.location.lat, stop.location.lng], {
              icon: L.divIcon({
                html: markerEl,
                className: 'marker-container',
                iconSize: [36, 36],
                iconAnchor: [18, 18]
              })
            }).addTo(map);
            
            // Add popup
            let popupContent = '<b>Stop ' + (index + 1) + ': ' + stop.name.en + '</b><br>';
            if (stop.eta && stop.eta.length > 0) {
              popupContent += 'ETA: ' + stop.eta[0];
            } else {
              popupContent += 'No ETA available';
            }
            
            marker.bindPopup(popupContent);
            
            // Highlight on click
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'stopSelected',
                index: index
              }));
            });
          })
            
          // Center to selecte stop if there is one
          if (selectedStopIndex >= 0) {
            map.setView([stops[selectedStopIndex].location.lat, stops[selectedStopIndex].location.lng], 16);
          } else {
            // Fit the map to show all stops
            map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
          }
          
          // Handle message from React Native
          window.handleMessage = function(message) {
            const data = JSON.parse(message);
            if (data.action === 'centerStop' && data.index >= 0 && data.index < stops.length) {
              map.setView([stops[data.index].location.lat, stops[data.index].location.lng], 16);
            }
          };
        } catch (error) {
          console.error('Error initializing map: ' + error.message);
          document.body.innerHTML = '<div style="color: red; padding: 20px;"><p>Error loading map: ' + error.message + '</p></div>';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            action: 'error',
            message: error.message
          }));
        }
      }

      // Initialize the map when the page is loaded
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initMap, 100);
      });
    </script>
  </body>
  </html>
  `;
  };


  // Render the WebView in the map view
  const renderMapView = () => {
    if (!selectedRoute) return null;

    const html = createLeafletHTML();

    return (
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    );
  };

  // Function to handle bus stop click
  const handleSelectStop = (index: number) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        action: 'centerStop',
        index: index
      }));
    }
  };

  const styles = StyleSheet.create({
    icons: {
      right: 10
    },
    routeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 12,
      borderRadius: 12,
      marginBottom: 2,
      shadowColor: isDarkMode ? '#000' : '#ccc',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    routeNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      width: 40,
      textAlign: 'center',
    },
    routeText: {
      fontSize: 16,
      color: isDarkMode ? '#ddd' : '#333',
      flexWrap: 'wrap',
    },
    etaText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDarkMode ? '#ffcc00' : '#007AFF',
    },
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
      padding: 16,
    },
    content: {
      flex: 1,
    },
    searchContainer: {
      padding: 8,
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#e0e0e0',
      zIndex: 1,
    },
    searchInput: {
      height: 40,
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 16,
      color: isDarkMode ? '#fff' : '#000',
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
      fontSize: 18,
      color: isDarkMode ? '#888' : '#aaa',
      textAlign: 'center',
      marginTop: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#e0e0e0',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: isDarkMode ? '#ffcc00' : '#007AFF',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDarkMode ? '#fff' : '#000',
      marginLeft: 16,
    },
    stopItem: {
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
    },
    stopNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
    },
    stopName: {
      fontSize: 16,
      color: isDarkMode ? '#ddd' : '#333',
      marginTop: 4,
      flexWrap: 'wrap',
    },
    stopNameChinese: {
      fontSize: 14,
      color: isDarkMode ? '#bbb' : '#7f8c8d',
      marginTop: 2,
      flexWrap: 'wrap',
    },
    mapContainer: {
      height: Dimensions.get('window').width,
      width: '100%',
    },
  });

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
