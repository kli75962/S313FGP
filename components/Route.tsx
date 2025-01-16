// components/Route.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar // Add this import
} from 'react-native';

interface RouteData {
  route: string;
  bound: string;
  service_type: string;
  orig_en: string;
  dest_en: string;
  orig_tc: string;
  dest_tc: string;
}

export default function Route() {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Filter routes when search query changes
  useEffect(() => {
    filterRoutes();
  }, [searchQuery, routes]);

  const fetchRoutes = async () => {
    try {
      const response = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route/');
      const json = await response.json();
      setRoutes(json.data);
      setFilteredRoutes(json.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching routes:', error);
      setLoading(false);
    }
  };

  const filterRoutes = () => {
    const query = searchQuery.toLowerCase().trim();
    if (query === '') {
      setFilteredRoutes(routes);
      return;
    }

    const filtered = routes.filter((route) => 
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
    <View style={styles.routeItem}>
      <Text style={styles.routeNumber}>Route {item.route}</Text>
      <View style={styles.routeDetails}>
        <Text style={styles.routeText}>
          From: {item.orig_en}
        </Text>
        <Text style={styles.routeText}>
          To: {item.dest_en}
        </Text>
        <Text style={styles.directionText}>
          Direction: {item.bound === 'O' ? 'Outbound' : 'Inbound'}
        </Text>
      </View>
    </View>
  );

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
          keyExtractor={(item) => `${item.route}-${item.bound}-${item.service_type}`}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmpty}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    // Add padding top for Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    // Remove any top margin or padding that might cause spacing issues
    zIndex: 1, // Ensure search bar stays on top
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f0f0f0',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
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
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  routeDetails: {
    gap: 4,
  },
  routeText: {
    fontSize: 16,
    color: '#34495e',
  },
  directionText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
