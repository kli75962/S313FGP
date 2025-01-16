import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import axios from 'axios';

type RouteList = {
  route: number;
  bound: number;
  service_type: number;
  orig_en: string;
  orig_tc: string;
  orig_sc: string;
  dest_en: string;
  dest_tc: string;
  dest_sc: string;
};

const DataFetcher: React.FC = () => {
  const [data, setData] = useState<RouteList[]>([]); // State for fetched data
  const [loading, setLoading] = useState<boolean>(true); // State for loading status
  const [error, setError] = useState<string | null>(null); // State for error messages

  useEffect(() => {
    // Fetch data when the component is mounted
    const fetchData = async () => {
      try {
        const response = await axios.get('https://data.etabus.gov.hk/v1/transport/kmb/route/', {
            params: {
              _limit: 10, // Fetch only 5 posts
            },
          });
        setData(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.route.toString()}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.title}>{item.orig_en}</Text>
          <Text style={styles.body}>{item.dest_en}</Text>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: 'red',
    fontSize: 18,
  },
  item: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 14,
    marginTop: 5,
  },
});

export default DataFetcher;
