import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, TouchableOpacity, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const TwitchStream = () => {
  const [twitchUrl, setTwitchUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [embedError, setEmbedError] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState(
    Platform.OS === 'web' ? { width: window.innerWidth, height: window.innerHeight } : Dimensions.get('window')
  );
  
  // Get responsive dimensions based on platform
  const getStreamDimensions = () => {
    if (Platform.OS === 'web') {
      const screenWidth = windowDimensions.width;
      // On web, use a larger height and responsive width
      return {
        height: Math.min(400, screenWidth * 0.4), // Max 400px or 40% of screen width
        width: screenWidth > 768 ? screenWidth - 64 : screenWidth - 32, // Larger margins on desktop
      };
    } else {
      // On mobile, keep it more compact
      return {
        height: 220,
        width: Dimensions.get('window').width - 32,
      };
    }
  };

  const streamDimensions = getStreamDimensions();

  useEffect(() => {
    fetchTwitchUrl();
  }, []);

  // Handle window resize on web to update dimensions
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const fetchTwitchUrl = async () => {
    try {
      const response = await fetch('http://localhost:8090/api/v1/app-settings');
      const data = await response.json();
      
      if (data.twitch_channel_url && data.twitch_channel_url.trim() !== '') {
        setTwitchUrl(data.twitch_channel_url);
      }
    } catch (error) {
      console.error('Error fetching Twitch URL:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmbedUrl = (channelUrl) => {
    if (!channelUrl) return null;
    
    const channelName = channelUrl.split('/').pop();
    
    return `https://player.twitch.tv/?channel=${channelName}&parent=localhost&parent=127.0.0.1&autoplay=false&muted=false`;
  };

  const openTwitchInBrowser = () => {
    if (twitchUrl) {
      if (Platform.OS === 'web') {
        window.open(twitchUrl, '_blank');
      } else {
        Linking.openURL(twitchUrl);
      }
    }
  };

  if (loading || !twitchUrl) {
    return null;
  }

  const embedUrl = getEmbedUrl(twitchUrl);
  if (!embedUrl) {
    return null;
  }

  // Show fallback UI if embed fails
  if (embedError) {
    const channelName = twitchUrl.split('/').pop();
    return (
      <View style={[styles.container, { 
        height: streamDimensions.height,
        width: streamDimensions.width,
        alignSelf: 'center',
      }]}>
        <View style={styles.fallbackContainer}>
          <Ionicons name="videocam-outline" size={48} color="#9146FF" />
          <Text style={styles.fallbackTitle}>Twitch Stream</Text>
          <Text style={styles.fallbackSubtitle}>@{channelName}</Text>
          <TouchableOpacity style={styles.openButton} onPress={openTwitchInBrowser}>
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.openButtonText}>Open in Twitch</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { 
      height: streamDimensions.height,
      width: streamDimensions.width,
      alignSelf: 'center',
    }]}>
      {Platform.OS === 'web' ? (
        <iframe
          src={embedUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allowFullScreen
          title="Twitch Stream"
          onError={() => setEmbedError(true)}
        />
      ) : (
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webview}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          onError={() => setEmbedError(true)}
          onHttpError={() => setEmbedError(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    // Height and width are now set dynamically based on platform
  },
  webview: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
    padding: 20,
  },
  fallbackTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  fallbackSubtitle: {
    color: '#9146FF',
    fontSize: 14,
    marginBottom: 20,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9146FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TwitchStream;