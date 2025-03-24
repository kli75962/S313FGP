import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const strings = {
  en: {
    title: 'Settings',
    language: 'Language',
    english: 'English',
    chinese: 'Chinese',
  },
  zh: {
    title: '設定',
    language: '語言',
    english: 'English',
    chinese: '繁體中文',
  },
};

export default function SettingPage() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const t = strings[language];

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('language');
      if (savedLanguage) {
        setLanguage(savedLanguage as 'en' | 'zh');
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const handleLanguageChange = async (newLang: 'en' | 'zh') => {
    try {
      await AsyncStorage.setItem('language', newLang);
      setLanguage(newLang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#1D1D1D' : '#f5f5f5',
    },
    content: {
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: 24,
    },
    section: {
      backgroundColor: isDarkMode ? '#2C2C2C' : '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: 16,
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#eee',
    },
    lastOption: {
      borderBottomWidth: 0,
    },
    languageText: {
      fontSize: 16,
      color: isDarkMode ? '#fff' : '#000',
      flex: 1,
    },
    selectedIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#007AFF',
      marginLeft: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t.title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.language}</Text>

          <TouchableOpacity
            style={[styles.languageOption, styles.lastOption]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text style={styles.languageText}>{t.english}</Text>
            {language === 'en' && <View style={styles.selectedIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.languageOption, styles.lastOption]}
            onPress={() => handleLanguageChange('zh')}
          >
            <Text style={styles.languageText}>{t.chinese}</Text>
            {language === 'zh' && <View style={styles.selectedIndicator} />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
