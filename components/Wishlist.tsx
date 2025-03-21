// Wishlist.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  Alert // Add this import
} from "react-native"; import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
// Import for WebView to display Leaflet
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useColorScheme } from 'react-native';



interface FavoriteRoute {
  routeId: string;
  bound: string;
}

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

export default function Wishlist() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
      padding: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '600',
      marginBottom: 16,
      color: isDarkMode ? '#fff' : '#000',
      textAlign: 'center',
    },
    routeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: isDarkMode ? '#000' : '#ccc',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    routeText: {
      fontSize: 18,
      color: isDarkMode ? '#ddd' : '#333',
    },
    emptyText: {
      fontSize: 18,
      color: isDarkMode ? '#888' : '#aaa',
      textAlign: 'center',
      marginTop: 20,
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: "#f5f5f5",
      paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
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
      flex: 1,
    },
    mapButton: {
      padding: 8,
    },
    stopItem: {
      backgroundColor: "white",
      padding: 16,
      borderRadius: 8,
      margin: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stopItemContent: {
      flex: 1,
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
    etaText: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#007AFF",
      marginTop: 8,
    },
    etaTextSmall: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#007AFF",
    },
    separator: {
      height: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    // Map styles
    mapContainer: {
      height: Dimensions.get('window').width,
      width: '100%',
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    horizontalStopList: {
      maxHeight: 100,
      marginTop: 10,
    },
    stopListItem: {
      padding: 10,
      backgroundColor: 'white',
      borderRadius: 8,
      marginRight: 8,
      minWidth: 150,
      maxWidth: 200,
    },
    selectedStopItem: {
      backgroundColor: '#e3f2fd',
      borderWidth: 2,
      borderColor: '#2196F3',
    },
  });

  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [stopsList, setStopsList] = useState<StopInfo[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [currentRouteForRefresh, setCurrentRouteForRefresh] = useState<RouteData | null>(null);
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(-1);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);
  const [isLocationButtonClicked, setIsLocationButtonClicked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      requestLocationPermission();
    }, [])
  );

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android' && __DEV__) {
        // Use hardcoded coordinates for Android emulator during development
        console.log("Using mock location for Android emulator");
        setUserLocation({
          latitude: 22.2820,
          longitude: 114.1588,
        });
      } else {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;
        console.log("phone", latitude, longitude);
        setUserLocation({
          latitude,
          longitude,
        });
      }

    } catch (error) {
      console.error("Error getting location:", error);
      // Fallback to hardcoded coordinates even if error occurs
      setUserLocation({
        latitude: 22.2820,
        longitude: 114.1588,
      });
    }
  };

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem("favorites");
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites);
        console.log("Loaded favorites:", parsed);
        setFavorites(parsed);
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  };

  const removeFavorite = async (routeId: string, bound: string) => {
    const updatedFavorites = favorites.filter(
      (fav) => !(fav.routeId === routeId && fav.bound === bound)
    );
    setFavorites(updatedFavorites);
    await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
  };

  const navigateToRouteDetails = (routeId: string, bound: string) => {
    console.log("Fetching details for:", { routeId, bound });
    fetchRouteInfo(routeId, bound);
  };

  // Fetch route information from API
  const fetchRouteInfo = async (routeId: string, bound: string) => {
    try {
      const response = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/route/");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const json = await response.json();
      const routeData = json.data.find(
        (route: RouteData) => route.route === routeId && route.bound === bound
      );

      if (routeData) {
        setSelectedRoute(routeData);
        fetchStopsForRoute(routeData);
      } else {
        console.error("Route not found:", routeId, bound);
      }
    } catch (error) {
      console.error("Error fetching route info:", error);
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

  // Set up auto-refresh of ETAs
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

  const handleShowMap = () => {
    setShowMap(true);
  };

  const handleSelectStop = (index: number) => {
    setSelectedStopIndex(index);
    setShowMap(true);
  };

  // Update the createLeafletHTML function to include Leaflet libraries
  const createLeafletHTML = () => {
    if (!stopsList.length) return '';

    // Convert stops to JavaScript array inside HTML
    const stopsData = JSON.stringify(stopsList.map((stop, index) => ({
      location: { lat: stop.lat, lng: stop.long },
      name: { en: stop.name_en, tc: stop.name_tc },
      eta: stop.eta || []
    })));

    // Prepare initial center based on selected stop or first stop
    const initialCenter = selectedStopIndex >= 0 ?
      `[${stopsList[selectedStopIndex].lat}, ${stopsList[selectedStopIndex].long}]` :
      `[${stopsList[0].lat}, ${stopsList[0].long}]`;

    // Create path for polyline
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
          });
          
          // Add user location if available
          const userLocation = ${userLocation ? `[${userLocation.latitude}, ${userLocation.longitude}]` : 'null'};
          if (userLocation) {
            const userMarker = L.marker(userLocation, {
              icon: L.divIcon({
                html: '<div style="background-color:#4CAF50;border-radius:50%;width:20px;height:20px;border:2px solid white;"></div>',
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map);
            userMarker.bindPopup("Your location");
          }
          
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
          setSelectedStopIndex(-1);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRoute(null);
                setCurrentRouteForRefresh(null); // Clear the refresh state
                setStopsList([]);
                setSelectedStopIndex(-1);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedRoute.route} To {selectedRoute.dest_en}
            </Text>
            {stopsList.length > 0 && (
              <TouchableOpacity onPress={handleShowMap} style={styles.mapButton}>
                <MaterialIcons name="map" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
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
                <TouchableOpacity
                  style={styles.stopItem}
                  onPress={() => handleSelectStop(index)}
                >
                  <View style={styles.stopItemContent}>
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

                  <MaterialIcons
                    name="location-on"
                    size={24}
                    color={isLocationButtonClicked && selectedStopIndex === index ? "#0056b3" : "#007AFF"}
                  />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  // const handleLocationButtonClick = (index: number) => {
  //   setIsLocationButtonClicked(true);
  //   console.log(`Location button clicked for stop index: ${index}`);
  //   setShowMap(true);
  // };

  const renderMapView = () => {
    if (!showMap || stopsList.length === 0) return null;

    const html = createLeafletHTML();
    console.log(html)
      ; return (
        <Modal
          visible={showMap}
          animationType="slide"
          onRequestClose={() => {
            setShowMap(false);
            setSelectedStopIndex(-1);
          }}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowMap(false);
                  setSelectedStopIndex(-1);
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close Map</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedRoute?.route} Route Map
              </Text>
            </View>

            <View style={[styles.mapContainer, { flex: 1 }]}>
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: html }}
                style={{ flex: 1 }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                onLoadStart={() => console.log('Load start')}
                onLoadEnd={() => console.log('WebView finished loading')}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('WebView error: ', nativeEvent);
                  Alert.alert('Map Error', 'Failed to load the map: ' + nativeEvent.description);
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('WebView HTTP error: ', nativeEvent);
                }}
              />
            </View>

            <FlatList
              data={stopsList}
              keyExtractor={(item, index) => `map-stop-${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.stopListItem,
                    selectedStopIndex === index && styles.selectedStopItem
                  ]}
                  onPress={() => setSelectedStopIndex(index)}
                >
                  <Text style={styles.stopNumber}>Stop {index + 1}</Text>
                  <Text style={styles.stopName}>{item.name_en}</Text>
                  {item.eta && item.eta.length > 0 && (
                    <Text style={styles.etaTextSmall}>ETA: {item.eta[0]}</Text>
                  )}
                </TouchableOpacity>
              )}
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.horizontalStopList}
            />
          </SafeAreaView>
        </Modal>

      );
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.action === 'stopSelected') {
        setSelectedStopIndex(data.index);
      } else if (data.action === 'error') {
        console.error('Error from WebView:', data.message);
        Alert.alert('Map Error', data.message);
      } else if (data.action === 'console.log') {
        console.log('WebView console.log:', data.message);
      } else if (data.action === 'console.error') {
        console.error('WebView console.error:', data.message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error, event.nativeEvent.data);
    }
  };

  const renderItem = ({ item }: { item: FavoriteRoute }) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => navigateToRouteDetails(item.routeId, item.bound)}
    >
      <Text style={styles.routeText}>
        Route {item.routeId} ({item.bound === "O" ? "Outbound" : "Inbound"})
      </Text>
      <TouchableOpacity onPress={() => removeFavorite(item.routeId, item.bound)}>
        <MaterialIcons name="delete" size={24} color="red" />
      </TouchableOpacity>
    </TouchableOpacity>
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
      {renderStopsList()}
      {renderMapView()}
    </SafeAreaView>
  );
}