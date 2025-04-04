// components/Route.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useColorScheme } from 'react-native';
import { Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from "@react-navigation/native";
import Settings from './Settings';

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

interface LanguageStrings {
  title: string;
  searchPlaceholder: string;
  outbound: string;
  inbound: string;
  close: string;
  to: string;
  stop: string;
  eta: string;
  noEta: string;
  noStopsFound: string;
  arriving: string;
  arrivingsoon: string;
  switchToZh: string;
  switchToEn: string;
}

const strings: { [key: string]: LanguageStrings } = {
  en: {
    title: "Bus Routes",
    searchPlaceholder: "Search routes...",
    outbound: "Outbound",
    inbound: "Inbound",
    close: "Close",
    to: "To",
    stop: "Stop",
    eta: "ETA",
    noEta: "No ETA available",
    noStopsFound: "No stops found for route",
    arriving: "Arriving",
    arrivingsoon: "Arriving soon",
    switchToZh: "繁",
    switchToEn: "ENG",
  },
  zh: {
    title: "巴士路線",
    searchPlaceholder: "搜尋路線...",
    outbound: "往",
    inbound: "往",
    close: "關閉",
    to: "往",
    stop: "站",
    eta: "預計到站時間",
    noEta: "暫無到站資訊",
    noStopsFound: "未能找到路線站點",
    arriving: "即將到達",
    arrivingsoon: "即將到達",
    switchToZh: "繁",
    switchToEn: "ENG",
  },
};

let count = 0;
export default function Route() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [showSettings, setShowSettings] = useState(false);
  const t = strings[language];

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
  const [expandedStops, setExpandedStops] = useState<Set<number>>(new Set());
  const [isMapView, setIsMapView] = useState(false);

  // Add a ref for the WebView
  const webViewRef = useRef<WebView>(null);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      loadLanguage();
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

  const toggleFavorite = async (routeId: string, bound: string) => {
    try {
      const exists = favorites.some(
        (fav) => fav.routeId === routeId && fav.bound === bound
      );

      const updatedFavorites = exists
        ? favorites.filter(
          (fav) => !(fav.routeId === routeId && fav.bound === bound)
        )
        : [...favorites, { routeId, bound }];

      await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
      setFavorites(updatedFavorites);
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
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
    fetchRoutes();
  }, []);

  useEffect(() => {
    if (routes.length > 0) {
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
    }
  }, [searchQuery, routes]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchAndUpdateETAs = async () => {
      if (!currentRouteForRefresh || !selectedRoute) return;

      try {
        const direction = currentRouteForRefresh.bound === "O" ? "outbound" : "inbound";
        const response = await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${currentRouteForRefresh.route}/${direction}/${currentRouteForRefresh.service_type}`
        );
        const json = await response.json();

        if (json.data && Array.isArray(json.data)) {
          await updateETAs(json.data, currentRouteForRefresh);
        }
      } catch (error) {
        console.error("Error fetching route stops:", error);
      }
    };

    if (currentRouteForRefresh && selectedRoute) {

      fetchAndUpdateETAs();
      intervalId = setInterval(fetchAndUpdateETAs, 60000);
    }

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
              return timeDiff > 0 ? `${timeDiff} mins` : t.arrivingsoon;
            })
          : [];

        stopsInfo.push({ ...stopJson.data, eta: etaTimes });

        // Update ETA in the map without refreshing
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

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder={t.searchPlaceholder}
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
      <Text style={styles.routeNumber}>{item.route}</Text>
      <View style={[styles.routeDetails, { flex: 1 }]}>
        <Text style={styles.routeText}>
          {t.outbound}: {language === 'zh' ? item.orig_tc : item.orig_en}
        </Text>
        <Text style={styles.routeText}>
          {t.to}: {language === 'zh' ? item.dest_tc : item.dest_en}
        </Text>
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

  const handleShowMap = () => {
    setIsMapView(!isMapView);
  };

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
          setIsMapView(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRoute(null);
                setCurrentRouteForRefresh(null);
                setStopsList([]);
                setIsMapView(false);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>{t.close}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
              {selectedRoute.route} {language === 'zh' ? selectedRoute.dest_tc : selectedRoute.dest_en}
            </Text>
            <TouchableOpacity onPress={handleShowMap} style={styles.mapButton}>
              <MaterialIcons
                name={isMapView ? "format-list-bulleted" : "map"}
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>
          </View>

          {isMapView ? (
            renderMapView()
          ) : (
            <>
              {loadingStops ? (
                <ActivityIndicator size="large" color="#0000ff" />
              ) : stopsList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {t.noStopsFound} {selectedRoute.route}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={stopsList}
                  keyExtractor={(item, index) => `${item.stop}-${index}`}
                  renderItem={renderStopItemList}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  const renderStopItem = ({ item, index }: { item: StopInfo; index: number }) => (
    <TouchableOpacity
      style={[
        styles.stopItem,
        selectedStopIndex === index && styles.selectedStopItem
      ]}
      onPress={() => {
        setSelectedStopIndex(index);
        // Send message to WebView to center on selected stop
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            action: 'centerStop',
            index: index
          }));
        }
      }}
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
  );

  const renderStopItemList = ({ item, index }: { item: StopInfo; index: number }) => (
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

  const toggleStopExpansion = (index: number) => {
    const newExpandedStops = new Set(expandedStops);
    if (expandedStops.has(index)) {
      newExpandedStops.delete(index);
    } else {
      newExpandedStops.add(index);
    }
    setExpandedStops(newExpandedStops);
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

    const initialCenter = stopsList.length > 0 ?
      `[${stopsList[0].lat}, ${stopsList[0].long}]` :
      '[0, 0]';

    const stopsData = stopsList.length > 0 ? JSON.stringify(stopsList.map((stop, index) => ({
      location: { lat: stop.lat, lng: stop.long },
      name: { en: stop.name_en, tc: stop.name_tc },
      eta: stop.eta || []
    }))) : '[]';

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
          
          // Add markers for each stop
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


  // Render the WebView in the map view
  const renderMapView = () => {
    if (!selectedRoute) return null;

    const html = createLeafletHTML();

    return (
      <View style={{ flex: 1 }}>
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
        <View style={styles.stopListContainer}>
          <FlatList
            data={stopsList}
            keyExtractor={(item, index) => `map-stop-${index}`}
            renderItem={renderStopItem}
            showsVerticalScrollIndicator={true}
            style={styles.verticalStopList}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </View>
    );
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
      fontSize: 16,
      color: '#2196F3',
      fontWeight: '600',
      marginBottom: 4,
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
    modalContainer: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
    },
    stopItem: {
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      padding: 16,
      margin: 8,
      borderRadius: 12,
      shadowColor: isDarkMode ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    stopItemExpanded: {
      backgroundColor: isDarkMode ? '#333' : '#f8f8f8',
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
      fontSize: 20,
      fontWeight: '600',
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: 4,
    },
    stopName: {
      fontSize: 16,
      color: isDarkMode ? '#ddd' : '#666',
    },
    etaContainer: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    etaLabel: {
      fontSize: 14,
      color: isDarkMode ? '#bbb' : '#666',
      marginBottom: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#eee',
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: '#007AFF',
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginHorizontal: 8,
    },
    mapButton: {
      padding: 8,
    },
    mapContainer: {
      height: Dimensions.get('window').width,
      width: '100%',
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
    },
    languageText: {
      color: isDarkMode ? '#fff' : '#333',
      fontSize: 16,
      fontWeight: '600',
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      marginBottom: 24,
      color: isDarkMode ? '#fff' : '#000',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    settingsButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 8,
      zIndex: 1,
    },
    stopListItem: {
      padding: 12,
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      borderRadius: 8,
      marginHorizontal: 8,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#e0e0e0',
    },
    stopListItemContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    selectedStopItem: {
      backgroundColor: isDarkMode ? '#1A237E' : '#e3f2fd',
      borderColor: isDarkMode ? '#64B5F6' : '#2196F3',
    },
    stopListContainer: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
    },
    verticalStopList: {
      flex: 1,
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
      <Text style={styles.title}>{t.title}</Text>
      <TouchableOpacity
        style={styles.languageSwitch}
        onPress={() => handleLanguageChange(language === 'en' ? 'zh' : 'en')}
      >
        <Text style={styles.languageText}>
          {language === 'en' ? t.switchToZh : t.switchToEn}
        </Text>
      </TouchableOpacity>
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

      <Modal
        visible={showSettings}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <Settings
          language={language}
          onLanguageChange={(newLang) => {
            setLanguage(newLang);
            setShowSettings(false);
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}
