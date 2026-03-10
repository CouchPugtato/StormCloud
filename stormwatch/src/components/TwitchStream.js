import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, TouchableOpacity, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { getApiBaseURL } from '../utils/config';
import { Ionicons } from '@expo/vector-icons';

const TwitchStream = () => {
  const [streamUrl, setStreamUrl] = useState('');
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
    fetchStreamUrl();
  }, []);

  useEffect(() => {
    setEmbedError(false);
  }, [streamUrl]);

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

  const fetchStreamUrl = async () => {
    try {
      const response = await fetch(`${getApiBaseURL()}/app-settings`);
      const data = await response.json();
      
      if (data.twitch_channel_url && data.twitch_channel_url.trim() !== '') {
        setStreamUrl(data.twitch_channel_url);
      }
    } catch (error) {
      console.error('Error fetching stream URL:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseStreamInfo = (urlString) => {
    if (!urlString) {
      return null;
    }

    try {
      const parsed = new URL(urlString);
      const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

      if (hostname.includes('twitch.tv')) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const channelName = pathParts[0];
        if (!channelName) {
          return null;
        }
        return {
          provider: 'twitch',
          label: channelName,
          embedUrl: (() => {
            const parents = Platform.OS === 'web'
              ? [`parent=${window.location.hostname}`]
              : ['parent=localhost', 'parent=127.0.0.1'];
            return `https://player.twitch.tv/?channel=${channelName}&${parents.join('&')}&autoplay=false&muted=false`;
          })(),
        };
      }

      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        let videoID = '';

        if (hostname.includes('youtu.be')) {
          videoID = parsed.pathname.split('/').filter(Boolean)[0] || '';
        } else if (parsed.pathname.startsWith('/watch')) {
          videoID = parsed.searchParams.get('v') || '';
        } else if (parsed.pathname.startsWith('/live/')) {
          videoID = parsed.pathname.split('/').filter(Boolean)[1] || '';
        } else if (parsed.pathname.startsWith('/embed/')) {
          videoID = parsed.pathname.split('/').filter(Boolean)[1] || '';
        }

        if (!videoID) {
          return null;
        }

        return {
          provider: 'youtube',
          label: videoID,
          embedUrl: `https://www.youtube.com/embed/${videoID}?autoplay=0&playsinline=1&rel=0`,
        };
      }
    } catch (error) {
      return null;
    }

    return null;
  };

  const openStreamInBrowser = () => {
    if (streamUrl) {
      if (Platform.OS === 'web') {
        window.open(streamUrl, '_blank');
      } else {
        Linking.openURL(streamUrl);
      }
    }
  };

  if (loading || !streamUrl) {
    return null;
  }

  const streamInfo = parseStreamInfo(streamUrl);
  if (!streamInfo) {
    return null;
  }

  // Show fallback UI if embed fails
  if (embedError) {
    return (
      <View style={[styles.container, { 
        height: streamDimensions.height,
        width: streamDimensions.width,
        alignSelf: 'center',
      }]}>
        <View style={styles.fallbackContainer}>
          <Ionicons name="videocam-outline" size={48} color={streamInfo.provider === 'twitch' ? '#9146FF' : '#FF0000'} />
          <Text style={styles.fallbackTitle}>
            {streamInfo.provider === 'twitch' ? 'Twitch Stream' : 'YouTube Stream'}
          </Text>
          <Text style={[styles.fallbackSubtitle, streamInfo.provider === 'youtube' && styles.youtubeSubtitle]}>
            {streamInfo.provider === 'twitch' ? `@${streamInfo.label}` : streamInfo.label}
          </Text>
          <TouchableOpacity
            style={[styles.openButton, streamInfo.provider === 'youtube' && styles.youtubeButton]}
            onPress={openStreamInBrowser}
          >
            <Ionicons name="open-outline" size={20} color="white" />
            <Text style={styles.openButtonText}>
              {streamInfo.provider === 'twitch' ? 'Open in Twitch' : 'Open in YouTube'}
            </Text>
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
          src={streamInfo.embedUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allowFullScreen
          title={streamInfo.provider === 'twitch' ? 'Twitch Stream' : 'YouTube Stream'}
          onError={() => setEmbedError(true)}
        />
      ) : (
        <WebView
          source={{ uri: streamInfo.embedUrl }}
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
  youtubeSubtitle: {
    color: '#FF0000',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9146FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  youtubeButton: {
    backgroundColor: '#FF0000',
  },
  openButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TwitchStream;
