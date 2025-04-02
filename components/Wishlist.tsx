
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
  Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
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
  eta?: string[];
}

interface LanguageStrings {
  title: string;
  noFavorites: string;
  outbound: string;
  inbound: string;
  close: string;
  to: string;
  stop: string;
  eta: string;
  noEta: string;
  noStopsFound: string;
  closeMap: string;
  routeMap: string;
  arriving: string;
  yourLocation: string;
  switchToZh: string;
  switchToEn: string;
}

const strings: { [key: string]: LanguageStrings } = {
  en: {
    title: "Favorite Routes",
    noFavorites: "No favorites added.",
    outbound: "Outbound",
    inbound: "Inbound",
    close: "Close",
    to: "To",
    stop: "Stop",
    eta: "ETA",
    noEta: "No ETA available",
    noStopsFound: "No stops found for route",
    closeMap: "Close Map",
    routeMap: "Route Map",
    arriving: "Arriving",
    yourLocation: "Your location",
    switchToZh: "繁",
    switchToEn: "ENG",
  },
  zh: {
    title: "收藏路線",
    noFavorites: "未有收藏路線",
    outbound: "往",
    inbound: "往",
    close: "關閉",
    to: "往",
    stop: "站",
    eta: "預計到站時間",
    noEta: "暫無到站資訊",
    noStopsFound: "未能找到路線站點",
    closeMap: "關閉地圖",
    routeMap: "路線地圖",
    arriving: "即將到達",
    yourLocation: "你的位置",
    switchToZh: "繁",
    switchToEn: "ENG",
  },
};


export default function Wishlist() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const t = strings[language];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
      padding: 16,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      marginBottom: 24,
      color: isDarkMode ? '#fff' : '#000',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    routeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    routeText: {
      fontSize: 20,
      fontWeight: '600',
      color: isDarkMode ? '#fff' : '#333',
    },
    emptyText: {
      fontSize: 18,
      color: isDarkMode ? '#888' : '#aaa',
      textAlign: 'center',
      marginTop: 20,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
      paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#e0e0e0',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: isDarkMode ? '#64B5F6' : '#007AFF',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginLeft: 16,
      flex: 1,
      color: isDarkMode ? '#fff' : '#000',
    },
    mapButton: {
      padding: 8,
    },
    stopItem: {
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 20,
      borderRadius: 16,
      margin: 8,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    stopHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    stopInfo: {
      flex: 1,
    },
    stopNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: isDarkMode ? '#fff' : '#2c3e50',
      marginBottom: 4,
    },
    stopName: {
      fontSize: 17,
      color: isDarkMode ? '#ddd' : '#34495e',
      marginBottom: 2,
    },
    stopNameChinese: {
      fontSize: 15,
      color: isDarkMode ? '#aaa' : '#7f8c8d',
    },
    etaContainer: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    etaText: {
      fontSize: 16,
      color: '#2196F3',
      fontWeight: '600',
      marginBottom: 4,
    },
    etaLabel: {
      fontSize: 14,
      color: isDarkMode ? '#aaa' : '#666',
      marginBottom: 8,
    },
    expandButton: {
      padding: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },

    mapContainer: {
      height: Dimensions.get('window').width,
      width: '100%',
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    horizontalStopList: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    stopListItem: {
      padding: 12,
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      borderRadius: 8,
      marginBottom: 8,
      width: '100%',
    },
    stopListItemContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    selectedStopItem: {
      backgroundColor: isDarkMode ? '#1A237E' : '#e3f2fd',
      borderWidth: 2,
      borderColor: isDarkMode ? '#64B5F6' : '#2196F3',
    },
    languageSwitch: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 8,
      borderRadius: 8,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      zIndex: 10,
    },
    languageButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    languageButtonActive: {
      backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
    },
    languageText: {
      color: isDarkMode ? '#fff' : '#333',
      fontSize: 16,
      fontWeight: '600',
    },
    languageTextActive: {
      color: isDarkMode ? '#fff' : '#000',
      fontWeight: '700',
    },
    separator: {
      height: 8,
    },
    etaTextSmall: {
      fontSize: 14,
      fontWeight: "bold",
      color: isDarkMode ? '#64B5F6' : '#007AFF',
      backgroundColor: isDarkMode ? '#1A237E' : '#e3f2fd',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    listContainer: {
      padding: 16,
      flexGrow: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
    },
    routeNumber: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      width: 40,
      textAlign: 'center',
    },
    routeDetails: {
      gap: 4,
    },
    fromToText: {
      fontSize: 16,
      color: isDarkMode ? '#ddd' : '#333',
      flexWrap: 'wrap',
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
  const webViewRef = useRef<WebView>(null);
  const [expandedStops, setExpandedStops] = useState<Set<number>>(new Set());
  const [routes, setRoutes] = useState<RouteData[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      requestLocationPermission();
      loadLanguage();
    }, [favorites])
  );

  const requestLocationPermission = async () => {
    try {


      setUserLocation({
        latitude: 22.3209,
        longitude: 114.1794,
      });


    } catch (error) {
      console.error("Error getting location:", error);
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
        setFavorites(parsed);
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  };

  const removeFavorite = async (routeId: string, bound: string) => {
    try {
      const updatedFavorites = favorites.filter(
        (fav) => !(fav.routeId === routeId && fav.bound === bound)
      );
      setFavorites(updatedFavorites);
      await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
      await loadFavorites();
      console.log("Updated favorites after removal:", updatedFavorites);
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  const navigateToRouteDetails = (routeId: string, bound: string) => {
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
            .filter((eta: any) => eta.seq === index + 1)
            .map((eta: any) => {
              const etaTime = new Date(eta.eta);
              const currentTime = new Date();
              const timeDiff = Math.round(
                (etaTime.getTime() - currentTime.getTime()) / 60000
              );
              return timeDiff > 0 ? `${timeDiff} mins` : t.arriving;
            })
          : [];

        stopsInfo.push({ ...stopJson.data, eta: etaTimes });

        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            action: 'updateETA',
            index: index,
            eta: etaTimes
          }));
        }

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
            await updateETAs(json.data, currentRouteForRefresh);
          }
        } catch (error) {
          console.error("Error fetching route stops:", error);
        }
      };

      fetchAndUpdateETAs();

      intervalId = setInterval(fetchAndUpdateETAs, 60000);
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
    // Send message to WebView to center on selected stop without refreshing
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        action: 'centerStop',
        index: index
      }));
    }
  };

  // Update the createLeafletHTML function to include ETA update handling
  const createLeafletHTML = () => {
    if (!stopsList.length || !selectedRoute) return '';

    const stopsData = JSON.stringify(stopsList.map((stop, index) => ({
      location: { lat: stop.lat, lng: stop.long },
      name: { en: stop.name_en, tc: stop.name_tc },
      eta: stop.eta || []
    })));

    const initialCenter = selectedStopIndex >= 0 ?
      `[${stopsList[selectedStopIndex].lat}, ${stopsList[selectedStopIndex].long}]` :
      `[${stopsList[0].lat}, ${stopsList[0].long}]`;

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
      let map;
      let markers = [];
      let popups = [];

      function initMap() {
        try {
          map = L.map('map').setView(${initialCenter}, 15);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          }).addTo(map);
          
          const stops = ${stopsData};
          const selectedStopIndex = ${selectedStopIndex};
          
          stops.forEach((stop, index) => {
            const markerEl = document.createElement('div');
            markerEl.className = 'custom-marker';
            if (index === selectedStopIndex) {
              markerEl.classList.add('active');
            }
            if (index < selectedStopIndex) {
              markerEl.classList.add('passed');
            }
            markerEl.innerText = (index + 1).toString();
            
            const marker = L.marker([stop.location.lat, stop.location.lng], {
              icon: L.divIcon({
                html: markerEl,
                className: 'marker-container',
                iconSize: [36, 36],
                iconAnchor: [18, 18]
              })
            }).addTo(map);
            
            markers.push(marker);
            
            let popupContent = '<b>Stop ' + (index + 1) + ': ' + stop.name.en + '</b><br>';
            if (stop.eta && stop.eta.length > 0) {
              popupContent += 'ETA: ' + stop.eta[0];
            } else {
              popupContent += 'No ETA available';
            }
            
            const popup = marker.bindPopup(popupContent);
            popups.push(popup);
            
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'stopSelected',
                index: index
              }));
            });
          });
            
          if (selectedStopIndex >= 0) {
            map.setView([stops[selectedStopIndex].location.lat, stops[selectedStopIndex].location.lng], 16);
          } else if (stops.length > 0) {
            map.setView([stops[0].location.lat, stops[0].location.lng], 15);
          }
          
          window.handleMessage = function(message) {
            const data = JSON.parse(message);
            if (data.action === 'centerStop' && data.index >= 0 && data.index < stops.length) {
              map.setView([stops[data.index].location.lat, stops[data.index].location.lng], 16);
            } else if (data.action === 'updateETA' && data.index >= 0 && data.index < markers.length) {
              const marker = markers[data.index];
              const popup = popups[data.index];
              const stop = stops[data.index];
              
              let popupContent = '<b>Stop ' + (data.index + 1) + ': ' + stop.name.en + '</b><br>';
              if (data.eta && data.eta.length > 0) {
                popupContent += 'ETA: ' + data.eta[0];
              } else {
                popupContent += 'No ETA available';
              }
              
              popup.setContent(popupContent);
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

      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initMap, 100);
      });
    </script>
  </body>
  </html>
  `;
  };

  const toggleStopExpansion = (index: number) => {
    const newExpandedStops = new Set(expandedStops);
    if (expandedStops.has(index)) {
      newExpandedStops.delete(index);
    } else {
      newExpandedStops.add(index);
    }
    setExpandedStops(newExpandedStops);
  };

  const renderStopItem = ({ item, index }: { item: StopInfo; index: number }) => (
    <TouchableOpacity
      style={styles.stopItem}
      onPress={() => toggleStopExpansion(index)}
    >
      <View style={styles.stopHeader}>
        <View style={styles.stopInfo}>
          <Text style={styles.stopNumber}>{t.stop} {index + 1}</Text>
          <Text style={styles.stopName}>
            {language === 'zh' ? item.name_tc : item.name_en}
          </Text>
        </View>
        <MaterialIcons
          name={expandedStops.has(index) ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={24}
          color={isDarkMode ? "#fff" : "#666"}
        />
      </View>

      {expandedStops.has(index) && (
        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>{t.eta}:</Text>
          {item.eta && item.eta.length > 0 ? (
            item.eta.map((eta, etaIndex) => (
              <Text key={etaIndex} style={styles.etaText}>
                {eta}
              </Text>
            ))
          ) : (
            <Text style={styles.etaText}>{t.noEta}</Text>
          )}
        </View>
      )}
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
          setCurrentRouteForRefresh(null);
          setStopsList([]);
          setSelectedStopIndex(-1);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRoute(null);
                setCurrentRouteForRefresh(null);
                setStopsList([]);
                setSelectedStopIndex(-1);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>{t.close}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedRoute.route} {t.to} {language === 'zh' ? selectedRoute.dest_tc : selectedRoute.dest_en}
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
                {t.noStopsFound} {selectedRoute.route} ({selectedRoute.bound === "O" ? t.outbound : t.inbound}).
              </Text>
            </View>
          ) : (
            <FlatList
              data={stopsList}
              renderItem={renderStopItem}
              keyExtractor={(item, index) => `${item.stop}-${index}`}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  const renderMapView = () => {
    if (!showMap || stopsList.length === 0) return null;

    const html = createLeafletHTML();
    return (
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => {
          setShowMap(false);
          setSelectedStopIndex(-1);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowMap(false);
                setSelectedStopIndex(-1);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>{t.closeMap}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedRoute?.route} {t.routeMap}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.mapContainer}>
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: html }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                onLoadStart={() => console.log('Load start')}
                onLoadEnd={() => console.log('WebView finished loading')}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('WebView error: ', nativeEvent);
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
                  onPress={() => handleSelectStop(index)}
                >
                  <View style={styles.stopListItemContent}>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopNumber}>{t.stop} {index + 1}</Text>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {language === 'zh' ? item.name_tc : item.name_en}
                      </Text>
                    </View>
                  </View>
                  {item.eta && item.eta.length > 0 && (
                    <View style={styles.etaContainer}>
                      {item.eta.slice(0, 3).map((eta, etaIndex) => (
                        <Text key={etaIndex} style={styles.etaTextSmall}>
                          {eta}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={true}
              style={styles.horizontalStopList}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    );
  };


  const renderItem = ({ item }: { item: FavoriteRoute }) => {
    const route = routes.find(r => r.route === item.routeId && r.bound === item.bound);
    if (!route) return null;

    return (
      <TouchableOpacity
        style={styles.routeItem}
        onPress={() => navigateToRouteDetails(item.routeId, item.bound)}
      >
        <Text style={styles.routeNumber}>{item.routeId}</Text>
        <View style={[styles.routeDetails, { flex: 1 }]}>
          <Text style={styles.fromToText}>
            From: {language === 'zh' ? route.orig_tc : route.orig_en}
          </Text>
          <Text style={styles.fromToText}>
            To: {language === 'zh' ? route.dest_tc : route.dest_en}
          </Text>
        </View>
        <TouchableOpacity onPress={() => removeFavorite(item.routeId, item.bound)}>
          <MaterialIcons name="delete" size={24} color="red" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('appLanguage');
      if (savedLanguage) {
        setLanguage(savedLanguage as 'en' | 'zh');
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const handleLanguageChange = async (newLang: 'en' | 'zh') => {
    try {
      await AsyncStorage.setItem('appLanguage', newLang);
      setLanguage(newLang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/route/");
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const json = await response.json();
        setRoutes(json.data);
      } catch (error) {
        console.error("Error fetching routes:", error);
      }
    };

    fetchRoutes();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t.title}</Text>

      <TouchableOpacity
        style={styles.languageSwitch}
        onPress={() => handleLanguageChange(language === 'en' ? 'zh' : 'en')}
      >
        <Text style={styles.languageText}>
          {language === 'en' ? t.switchToZh : t.switchToEn}
        </Text>
      </TouchableOpacity>
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.routeId}-${item.bound}`}
        ListEmptyComponent={<Text style={styles.emptyText}>{t.noFavorites}</Text>}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      {renderStopsList()}
      {renderMapView()}
    </SafeAreaView>
  );
}