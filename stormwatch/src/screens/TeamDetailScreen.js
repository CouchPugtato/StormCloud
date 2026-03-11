import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';
import apiService from '../utils/apiService';
import PerformanceGraphs from '../components/PerformanceGraphs';

const { width } = Dimensions.get('window');

export default function TeamDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { team } = route.params || {};
  
  const [teamData, setTeamData] = useState(team || null);
  const [loading, setLoading] = useState(!team);
  const [error, setError] = useState(null);
  const [pitData, setPitData] = useState({
    weight: '',
    dimensions: '',
    drivebase: '',
    notes: '',
    robot_weight: '',
    robot_dimensions: '',
    drivebase_type: '',
    has_vision: false,
    vision_system: false,
    max_coral_level: '',
    can_climb: false,
    max_climb_level: '',
    climb_time_estimate: '',
    auto_mobility: false,
    auto_scoring_capability: '',
    preferred_starting_position: '',
    autonomous_capabilities: '',
    autonomous_reliability: '',
    programming_language: '',
    strategy_notes: '',
    strengths: '',
    weaknesses: '',
    general_notes: '',
    comments: ''
  });
  const [matchScoutingData, setMatchScoutingData] = useState([]);
  const [notes, setNotes] = useState('');
  const [savingPitNotes, setSavingPitNotes] = useState(false);
  const [savingScoutingNotes, setSavingScoutingNotes] = useState(false);
  const [pitNotesSaved, setPitNotesSaved] = useState(false);
  const [scoutingNotesSaved, setScoutingNotesSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [robotPhotoAspectRatio, setRobotPhotoAspectRatio] = useState(4 / 3);
  const [showWebCameraModal, setShowWebCameraModal] = useState(false);
  const [webCameraError, setWebCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webStreamRef = useRef(null);

  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (team && team.team_key) {
        try {
          setLoading(true);
          setError(null);
          const detailedTeam = await apiService.getTeam(team.team_key);
          setTeamData(detailedTeam);
          
          setPitData({
            weight: detailedTeam.robot_weight || '',
            dimensions: detailedTeam.robot_dimensions || '',
            drivebase: detailedTeam.drivebase_type || '',
            notes: detailedTeam.pit_notes || '',
            robot_weight: detailedTeam.robot_weight || '',
            robot_dimensions: detailedTeam.robot_dimensions || '',
            drivebase_type: detailedTeam.drivebase_type || '',
            has_vision: detailedTeam.has_vision || false,
            max_coral_level: detailedTeam.max_coral_level || '',
            can_climb: detailedTeam.can_climb || false,
            autonomous_capabilities: detailedTeam.autonomous_capabilities || '',
            programming_language: detailedTeam.programming_language || '',
            strengths: detailedTeam.strengths || '',
            weaknesses: detailedTeam.weaknesses || '',
            comments: detailedTeam.comments || ''
          });
          
          const eventKey = '';
          const pitScoutingData = await apiService.getPitScoutingData(detailedTeam.team_key, eventKey);
          if (pitScoutingData) {
            setPitData(prev => ({
              ...prev,
              robot_weight: pitScoutingData.robot_weight || prev.robot_weight,
              robot_dimensions: pitScoutingData.robot_dimensions || prev.robot_dimensions,
              drivebase_type: pitScoutingData.drivebase_type || prev.drivebase_type,
              has_vision: pitScoutingData.has_vision || prev.has_vision,
              max_coral_level: pitScoutingData.max_coral_level || prev.max_coral_level,
              can_climb: pitScoutingData.can_climb || prev.can_climb,
              autonomous_capabilities: pitScoutingData.autonomous_capabilities || prev.autonomous_capabilities,
              programming_language: pitScoutingData.programming_language || prev.programming_language,
              strengths: pitScoutingData.strengths || prev.strengths,
              weaknesses: pitScoutingData.weaknesses || prev.weaknesses,
              comments: pitScoutingData.comments || prev.comments
            }));
          }
          
          const matchScoutingData = await apiService.getTeamMatchScoutingData(detailedTeam.team_key);
          if (matchScoutingData) {
            setMatchScoutingData(matchScoutingData);
          }
          
          if (detailedTeam.scouting_notes) {
            setNotes(detailedTeam.scouting_notes);
          }
        } catch (err) {
          console.error('Failed to fetch team details:', err);
          setError('Failed to load team details');
          setTeamData(team);
        } finally {
          setLoading(false);
        }
      } else {
        setError('No team data available');
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [team]);

  useEffect(() => {
    if (!teamData?.robot_photo) {
      setRobotPhotoAspectRatio(4 / 3);
      return;
    }

    Image.getSize(
      teamData.robot_photo,
      (width, height) => {
        if (width > 0 && height > 0) {
          setRobotPhotoAspectRatio(width / height);
        }
      },
      () => {
        setRobotPhotoAspectRatio(4 / 3);
      }
    );
  }, [teamData?.robot_photo]);

  const savePitNotes = async () => {
    if (!teamData?.team_key) return;
    
    try {
      setSavingPitNotes(true);
      setPitNotesSaved(false);
      await apiService.updateTeamNotes(teamData.team_key, {
        pit_notes: pitData.notes,
        scouting_notes: notes,
        robot_weight: pitData.weight,
        robot_dimensions: pitData.dimensions,
        drivebase_type: pitData.drivebase
      });
      setTeamData(prev => ({ 
        ...prev, 
        pit_notes: pitData.notes,
        robot_weight: pitData.weight,
        robot_dimensions: pitData.dimensions,
        drivebase_type: pitData.drivebase
      }));
      
      setPitNotesSaved(true);
      setTimeout(() => setPitNotesSaved(false), 2000); // show success for 2 seconds
    } catch (err) {
      console.error('Failed to save pit notes:', err);
    } finally {
      setSavingPitNotes(false);
    }
  };

  const saveScoutingNotes = async () => {
    if (!teamData?.team_key) return;
    
    try {
      setSavingScoutingNotes(true);
      setScoutingNotesSaved(false);
      await apiService.updateTeamNotes(teamData.team_key, {
        pit_notes: pitData.notes,
        scouting_notes: notes,
        robot_weight: pitData.weight,
        robot_dimensions: pitData.dimensions,
        drivebase_type: pitData.drivebase
      });
      setTeamData(prev => ({ 
        ...prev, 
        scouting_notes: notes,
        pit_notes: pitData.notes,
        robot_weight: pitData.weight,
        robot_dimensions: pitData.dimensions,
        drivebase_type: pitData.drivebase
      }));
      
      setScoutingNotesSaved(true);
      setTimeout(() => setScoutingNotesSaved(false), 2000); // show success for 2 seconds
    } catch (err) {
      console.error('Failed to save scouting notes:', err);
    } finally {
      setSavingScoutingNotes(false);
    }
  };

  const canEditPhoto = !!user && user.role !== USER_ROLES.VIEWER;

  const stopWebCameraStream = () => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track) => track.stop());
      webStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !showWebCameraModal) {
      stopWebCameraStream();
      return undefined;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        setWebCameraError('');
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        webStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        setWebCameraError(error.message || 'Unable to access the camera.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopWebCameraStream();
    };
  }, [showWebCameraModal]);

  const captureWebCameraPhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !teamData?.team_key || photoBusy) {
      return;
    }

    try {
      setPhotoBusy(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, width, height);
      const robotPhoto = canvas.toDataURL('image/jpeg', 0.8);
      await apiService.updateTeamPhoto(teamData.team_key, robotPhoto);
      setTeamData((prev) => ({ ...prev, robot_photo: robotPhoto }));
      setShowWebCameraModal(false);
      stopWebCameraStream();
    } catch (error) {
      Alert.alert('Photo Error', error.message || 'Unable to capture robot photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRetakeRobotPhoto = async () => {
    if (!teamData?.team_key || photoBusy || !canEditPhoto) {
      return;
    }

    try {
      setPhotoBusy(true);
      let result = null;

      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera Required', 'Camera access is required to take a robot photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.5,
          aspect: [4, 3],
          base64: true,
        });
      } else {
        setShowWebCameraModal(true);
        return;
      }

      if (result?.canceled || !result?.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Photo Error', 'Unable to read the selected image.');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const robotPhoto = `data:${mimeType};base64,${asset.base64}`;
      await apiService.updateTeamPhoto(teamData.team_key, robotPhoto);
      setTeamData((prev) => ({ ...prev, robot_photo: robotPhoto }));
    } catch (error) {
      Alert.alert('Photo Error', error.message || 'Unable to save robot photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.colors.statusBar} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading team details...</Text>
      </View>
    );
  }

  if (error || !teamData) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.colors.statusBar} />
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: theme.colors.text }]}>{error || 'Team not found'}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const teamNumber = teamData.team_num || teamData.id || '0000';
  const teamName = teamData.name || `Team ${teamNumber}`;
  const teamLocation = teamData.city && teamData.state 
    ? `${teamData.city}, ${teamData.state}${teamData.country ? `, ${teamData.country}` : ''}` 
    : teamData.location || 'Location not available';
  
  const epaData = teamData.EPA || teamData.epa || {};
  const hasEpaData = Object.keys(epaData).length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />
      {Platform.OS === 'web' ? (
        <Modal
          transparent
          visible={showWebCameraModal}
          animationType="fade"
          onRequestClose={() => {
            setShowWebCameraModal(false);
            stopWebCameraStream();
          }}
        >
          <View style={styles.webCameraBackdrop}>
            <View style={[styles.webCameraModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.webCameraTitle, { color: theme.colors.text }]}>Capture Robot Photo</Text>
              <Text style={[styles.webCameraSubtitle, { color: theme.colors.textSecondary }]}>
                Take a fresh robot photo from the camera.
              </Text>
              {webCameraError ? (
                <Text style={styles.webCameraError}>{webCameraError}</Text>
              ) : (
                <View style={styles.webCameraPreviewWrap}>
                  {React.createElement('video', {
                    ref: videoRef,
                    autoPlay: true,
                    playsInline: true,
                    muted: true,
                    style: {
                      width: '100%',
                      borderRadius: '12px',
                      backgroundColor: '#000',
                    },
                  })}
                  {React.createElement('canvas', {
                    ref: canvasRef,
                    style: { display: 'none' },
                  })}
                </View>
              )}
              <View style={styles.webCameraActions}>
                <TouchableOpacity
                  style={[styles.webCameraButtonSecondary, { borderColor: theme.colors.border }]}
                  onPress={() => {
                    setShowWebCameraModal(false);
                    stopWebCameraStream();
                  }}
                >
                  <Text style={[styles.webCameraButtonSecondaryText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webCameraButtonPrimary, { backgroundColor: theme.colors.primary }, (photoBusy || !!webCameraError) && styles.photoActionButtonDisabled]}
                  onPress={captureWebCameraPhoto}
                  disabled={photoBusy || !!webCameraError}
                >
                  <Text style={styles.photoActionButtonText}>{photoBusy ? 'Saving...' : 'Take Photo'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team {teamNumber}</Text>
          <Text style={styles.headerSubtitle}>
            {teamName}
          </Text>
        </View>
        <View style={[styles.summarySection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.teamHeader}>
            <View style={[styles.teamIcon, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.teamIconText}>{teamNumber}</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: theme.colors.text }]}>{teamName}</Text>
              <Text style={[styles.teamLocation, { color: theme.colors.textSecondary }]}>
                <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                {` ${teamLocation}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Robot Photo</Text>
          <View style={styles.robotPhotoSection}>
            {teamData.robot_photo ? (
              <View style={[styles.robotPhotoFrame, { aspectRatio: robotPhotoAspectRatio, backgroundColor: theme.colors.background }]}>
                <Image source={{ uri: teamData.robot_photo }} style={styles.robotPhoto} resizeMode="contain" />
              </View>
            ) : (
              <View style={[styles.robotPhotoPlaceholder, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="image-outline" size={34} color={theme.colors.textSecondary} />
                <Text style={[styles.robotPhotoPlaceholderText, { color: theme.colors.textSecondary }]}>No robot photo yet</Text>
              </View>
            )}
            {canEditPhoto ? (
              <TouchableOpacity
                style={[styles.photoActionButton, { backgroundColor: theme.colors.primary }, photoBusy && styles.photoActionButtonDisabled]}
                onPress={handleRetakeRobotPhoto}
                disabled={photoBusy}
              >
                <Text style={styles.photoActionButtonText}>
                  {photoBusy ? 'Saving...' : teamData.robot_photo ? 'Retake Robot Photo' : 'Take Robot Photo'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>EPA Metrics (Statbotics)</Text>
          {hasEpaData ? (
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                  {epaData.epa_end ? epaData.epa_end.toFixed(1) : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Overall EPA</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.metricValue, { color: '#4CAF50' }]}>
                  {epaData.epa_auto ? epaData.epa_auto.toFixed(1) : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Auto EPA</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.metricValue, { color: '#FF9800' }]}>
                  {epaData.epa_teleop ? epaData.epa_teleop.toFixed(1) : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Teleop EPA</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.metricValue, { color: '#E91E63' }]}>
                  {epaData.epa_endgame ? epaData.epa_endgame.toFixed(1) : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Endgame EPA</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.noDataContainer, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noDataText, { color: theme.colors.text }]}>EPA data not available</Text>
              <Text style={[styles.noDataSubtext, { color: theme.colors.textSecondary }]}>This team may not have competed in the current season yet</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Graphs</Text>
          <PerformanceGraphs matchScoutingData={matchScoutingData} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pit Scouting</Text>
          
          {(pitData.robot_weight || pitData.robot_dimensions || pitData.drivebase_type || 
            pitData.has_vision || pitData.vision_system || pitData.max_coral_level || pitData.can_climb || 
            pitData.max_climb_level || pitData.climb_time_estimate || pitData.autonomous_capabilities || 
            pitData.auto_mobility || pitData.auto_scoring_capability || pitData.preferred_starting_position ||
            pitData.programming_language || pitData.strengths || pitData.weaknesses || pitData.comments ||
            pitData.strategy_notes || pitData.general_notes || pitData.autonomous_reliability) ? (
            <View style={styles.pitDataContainer}>
              <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Robot Specifications</Text>
                {pitData.robot_weight && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="barbell-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Weight:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.robot_weight}</Text>
                  </View>
                )}
                {pitData.robot_dimensions && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="resize-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Dimensions:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.robot_dimensions}</Text>
                  </View>
                )}
                {pitData.drivebase_type && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="car-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Drivetrain:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.drivebase_type}</Text>
                  </View>
                )}
                {pitData.programming_language && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="code-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Programming:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.programming_language}</Text>
                  </View>
                )}
              </View>
              
              {/* Game Capabilities */}
              <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Game Capabilities</Text>
                {(pitData.has_vision !== undefined || pitData.vision_system !== undefined) && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="eye-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Vision System:</Text>
                    <View style={[styles.pitDataBadge, { backgroundColor: (pitData.has_vision || pitData.vision_system) ? '#4CAF50' : '#F44336' }]}>
                      <Text style={[styles.pitDataBadgeText, { color: 'white' }]}>
                        {(pitData.has_vision || pitData.vision_system) ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>
                )}
                {pitData.max_coral_level && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="arrow-up-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Max Coral Level:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.max_coral_level}</Text>
                  </View>
                )}
                {pitData.can_climb !== undefined && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="fitness-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Can Climb:</Text>
                    <View style={[styles.pitDataBadge, { backgroundColor: pitData.can_climb ? '#4CAF50' : '#F44336' }]}>
                      <Text style={[styles.pitDataBadgeText, { color: 'white' }]}>
                        {pitData.can_climb ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>
                )}
                {pitData.max_climb_level && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="trending-up-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Max Climb Level:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.max_climb_level}</Text>
                  </View>
                )}
                {pitData.climb_time_estimate && (
                  <View style={styles.pitDataRow}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Climb Time:</Text>
                    <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.climb_time_estimate}s</Text>
                  </View>
                )}
              </View>
              
              {/* Autonomous Capabilities */}
              {(pitData.autonomous_capabilities || pitData.auto_mobility !== undefined || 
                pitData.auto_scoring_capability || pitData.preferred_starting_position || 
                pitData.autonomous_reliability) && (
                <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Autonomous Capabilities</Text>
                  {pitData.auto_mobility !== undefined && (
                    <View style={styles.pitDataRow}>
                      <Ionicons name="walk-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Auto Mobility:</Text>
                      <View style={[styles.pitDataBadge, { backgroundColor: pitData.auto_mobility ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.pitDataBadgeText, { color: 'white' }]}>
                          {pitData.auto_mobility ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {pitData.auto_scoring_capability && (
                    <View style={styles.pitDataColumn}>
                      <View style={styles.pitDataRow}>
                        <Ionicons name="trophy-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Auto Scoring:</Text>
                      </View>
                      <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.auto_scoring_capability}</Text>
                    </View>
                  )}
                  {pitData.autonomous_capabilities && (
                    <View style={styles.pitDataColumn}>
                      <View style={styles.pitDataRow}>
                        <Ionicons name="play-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Auto Details:</Text>
                      </View>
                      <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.autonomous_capabilities}</Text>
                    </View>
                  )}
                  {pitData.preferred_starting_position && (
                    <View style={styles.pitDataRow}>
                      <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Start Position:</Text>
                      <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.preferred_starting_position}</Text>
                    </View>
                  )}
                  {pitData.autonomous_reliability && (
                    <View style={styles.pitDataRow}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Auto Reliability:</Text>
                      <Text style={[styles.pitDataValue, { color: theme.colors.text }]}>{pitData.autonomous_reliability}/5</Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Strategy & Notes */}
              {pitData.strategy_notes && (
                <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Strategy Notes</Text>
                  <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.strategy_notes}</Text>
                </View>
              )}
              
              {/* Team Assessment */}
              {(pitData.strengths || pitData.weaknesses) && (
                <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Team Assessment</Text>
                  {pitData.strengths && (
                    <View style={styles.pitDataColumn}>
                      <View style={styles.pitDataRow}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                        <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Strengths:</Text>
                      </View>
                      <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.strengths}</Text>
                    </View>
                  )}
                  {pitData.weaknesses && (
                    <View style={styles.pitDataColumn}>
                      <View style={styles.pitDataRow}>
                        <Ionicons name="alert-circle-outline" size={16} color="#FF9800" />
                        <Text style={[styles.pitDataLabel, { color: theme.colors.textSecondary }]}>Areas for Improvement:</Text>
                      </View>
                      <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.weaknesses}</Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* General Notes */}
              {pitData.general_notes && (
                <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>General Notes</Text>
                  <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.general_notes}</Text>
                </View>
              )}
              
              {/* Additional Comments */}
              {pitData.comments && (
                <View style={[styles.pitDataSection, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.pitDataSectionTitle, { color: theme.colors.primary }]}>Additional Comments</Text>
                  <Text style={[styles.pitDataText, { color: theme.colors.text }]}>{pitData.comments}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.noDataContainer, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="clipboard-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noDataText, { color: theme.colors.text }]}>No pit scouting data available</Text>
              <Text style={[styles.noDataSubtext, { color: theme.colors.textSecondary }]}>Complete the pit scouting form to see detailed information</Text>
            </View>
          )}
          
          {/* Navigation to Full Pit Scouting Form */}
          <TouchableOpacity
            style={[styles.pitScoutButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('PitScoutingForm', { 
              teamNumber: teamData?.team_num,
              eventKey: ''
            })}
          >
            <Ionicons name="clipboard-outline" size={20} color="white" />
            <Text style={styles.pitScoutButtonText}>Complete Pit Scouting Form</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
          
          {/* Legacy Quick Notes */}
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Quick Notes:</Text>
            <TextInput
              style={[styles.formTextArea, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pitData.notes}
              onChangeText={(text) => setPitData({...pitData, notes: text})}
              placeholder="Quick observations or notes..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.saveButton, { 
              backgroundColor: pitNotesSaved ? theme.colors.secondary : theme.colors.primary, 
              opacity: savingPitNotes ? 0.6 : 1 
            }]}
            onPress={savePitNotes}
            disabled={savingPitNotes}
          >
            {savingPitNotes ? (
              <ActivityIndicator size="small" color="white" />
            ) : pitNotesSaved ? (
              <Ionicons name="checkmark-outline" size={20} color="white" />
            ) : (
              <Ionicons name="save-outline" size={20} color="white" />
            )}
            <Text style={styles.saveButtonText}>
              {savingPitNotes ? 'Saving...' : pitNotesSaved ? 'Saved!' : 'Save Quick Notes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scouting Notes</Text>
          <TextInput
            style={[styles.notesTextArea, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add your observations, strategies, and notes about this team..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            numberOfLines={6}
          />
          <TouchableOpacity
            style={[styles.saveButton, { 
              backgroundColor: scoutingNotesSaved ? theme.colors.secondary : theme.colors.primary, 
              opacity: savingScoutingNotes ? 0.6 : 1 
            }]}
            onPress={saveScoutingNotes}
            disabled={savingScoutingNotes}
          >
            {savingScoutingNotes ? (
              <ActivityIndicator size="small" color="white" />
            ) : scoutingNotesSaved ? (
              <Ionicons name="checkmark-outline" size={20} color="white" />
            ) : (
              <Ionicons name="save-outline" size={20} color="white" />
            )}
            <Text style={styles.saveButtonText}>
              {savingScoutingNotes ? 'Saving...' : scoutingNotesSaved ? 'Saved!' : 'Save Scouting Notes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Match Scouting Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Match Scouting Data</Text>
          
          {matchScoutingData && matchScoutingData.length > 0 ? (
            <View style={styles.matchScoutingContainer}>
              {matchScoutingData.map((matchData, index) => (
                <View key={index} style={[styles.matchScoutingCard, { backgroundColor: theme.colors.background }]}>
                  {/* Match Header */}
                  <View style={styles.matchHeader}>
                    <View style={styles.matchHeaderLeft}>
                      <Ionicons name="trophy-outline" size={20} color={theme.colors.primary} />
                      <Text style={[styles.matchTitle, { color: theme.colors.text }]}>
                        {matchData.match_key || `Match ${index + 1}`}
                      </Text>
                    </View>
                    <Text style={[styles.matchDate, { color: theme.colors.textSecondary }]}>
                      {matchData.scout_name && `Scout: ${matchData.scout_name}`}
                    </Text>
                  </View>
                  
                  {/* Auto Period */}
                  <View style={[styles.matchDataSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.matchDataSectionTitle, { color: theme.colors.primary }]}>Autonomous Period</Text>
                    <View style={styles.matchDataGrid}>
                      {matchData.auto_coral_l1 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L1:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_coral_l1}</Text>
                        </View>
                      )}
                      {matchData.auto_coral_l2 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L2:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_coral_l2}</Text>
                        </View>
                      )}
                      {matchData.auto_coral_l3 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L3:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_coral_l3}</Text>
                        </View>
                      )}
                      {matchData.auto_coral_l4 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L4:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_coral_l4}</Text>
                        </View>
                      )}
                      {matchData.auto_algae_net > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Algae Net:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_algae_net}</Text>
                        </View>
                      )}
                      {matchData.auto_algae_processor > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Algae Processor:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_algae_processor}</Text>
                        </View>
                      )}
                      {matchData.auto_reef > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Reef:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.auto_reef}</Text>
                        </View>
                      )}
                      {matchData.auto_mobility !== undefined && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Mobility:</Text>
                          <View style={[styles.matchDataBadge, { backgroundColor: matchData.auto_mobility ? '#4CAF50' : '#F44336' }]}>
                            <Text style={[styles.matchDataBadgeText, { color: 'white' }]}>
                              {matchData.auto_mobility ? 'Yes' : 'No'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Teleop Period */}
                  <View style={[styles.matchDataSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.matchDataSectionTitle, { color: theme.colors.primary }]}>Teleop Period</Text>
                    <View style={styles.matchDataGrid}>
                      {matchData.teleop_coral_l1 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L1:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_coral_l1}</Text>
                        </View>
                      )}
                      {matchData.teleop_coral_l2 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L2:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_coral_l2}</Text>
                        </View>
                      )}
                      {matchData.teleop_coral_l3 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L3:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_coral_l3}</Text>
                        </View>
                      )}
                      {matchData.teleop_coral_l4 > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Coral L4:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_coral_l4}</Text>
                        </View>
                      )}
                      {matchData.teleop_algae_net > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Algae Net:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_algae_net}</Text>
                        </View>
                      )}
                      {matchData.teleop_algae_processor > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Algae Processor:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_algae_processor}</Text>
                        </View>
                      )}
                      {matchData.teleop_reef > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Reef:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.teleop_reef}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Endgame */}
                  <View style={[styles.matchDataSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.matchDataSectionTitle, { color: theme.colors.primary }]}>Endgame</Text>
                    <View style={styles.matchDataGrid}>
                      {matchData.climb_level && matchData.climb_level !== 'None' && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Climb Level:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.climb_level}</Text>
                        </View>
                      )}
                      {matchData.climb_time > 0 && (
                        <View style={styles.matchDataItem}>
                          <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Climb Time:</Text>
                          <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.climb_time}s</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Performance Ratings */}
                  {(matchData.defense_rating > 0 || matchData.speed_rating > 0 || matchData.stability_rating > 0) && (
                    <View style={[styles.matchDataSection, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.matchDataSectionTitle, { color: theme.colors.primary }]}>Performance Ratings</Text>
                      <View style={styles.matchDataGrid}>
                        {matchData.defense_rating > 0 && (
                          <View style={styles.matchDataItem}>
                            <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Defense:</Text>
                            <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.defense_rating}/5</Text>
                          </View>
                        )}
                        {matchData.speed_rating > 0 && (
                          <View style={styles.matchDataItem}>
                            <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Speed:</Text>
                            <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.speed_rating}/5</Text>
                          </View>
                        )}
                        {matchData.stability_rating > 0 && (
                          <View style={styles.matchDataItem}>
                            <Text style={[styles.matchDataLabel, { color: theme.colors.textSecondary }]}>Stability:</Text>
                            <Text style={[styles.matchDataValue, { color: theme.colors.text }]}>{matchData.stability_rating}/5</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                  
                  {/* General Notes */}
                  {matchData.general_notes && (
                    <View style={[styles.matchDataSection, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.matchDataSectionTitle, { color: theme.colors.primary }]}>Notes</Text>
                      <Text style={[styles.matchDataText, { color: theme.colors.text }]}>{matchData.general_notes}</Text>
                    </View>
                  )}
                  
                  {/* Robot Issues */}
                  {matchData.robot_broke && (
                    <View style={[styles.matchDataSection, { backgroundColor: '#FFF3E0' }]}>
                      <View style={styles.matchDataRow}>
                        <Ionicons name="warning-outline" size={16} color="#FF9800" />
                        <Text style={[styles.matchDataLabel, { color: '#FF9800', marginLeft: 8 }]}>Robot Issues Reported</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.noDataContainer, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noDataText, { color: theme.colors.text }]}>No match scouting data available</Text>
              <Text style={[styles.noDataSubtext, { color: theme.colors.textSecondary }]}>Complete match scouting forms to see detailed performance data</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 40 : 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  summarySection: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  robotPhotoSection: {
    marginTop: 18,
    marginBottom: 18,
    alignItems: 'center',
  },
  robotPhotoFrame: {
    width: '100%',
    maxWidth: 420,
    maxHeight: 320,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    alignSelf: 'center',
  },
  robotPhoto: {
    width: '100%',
    height: '100%',
  },
  robotPhotoPlaceholder: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  robotPhotoPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoActionButton: {
    borderRadius: 10,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    alignSelf: 'center',
  },
  photoActionButtonDisabled: {
    opacity: 0.6,
  },
  photoActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  webCameraBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  webCameraModal: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  webCameraTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  webCameraSubtitle: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },
  webCameraPreviewWrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  webCameraError: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  webCameraActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  webCameraButtonPrimary: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  webCameraButtonSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  webCameraButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  teamHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  teamIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teamLocation: {
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },

  formRow: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickSummary: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  pitScoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pitScoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
    flex: 1,
    textAlign: 'center',
  },
  pitDataContainer: {
    marginBottom: 16,
  },
  pitDataSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pitDataSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pitDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pitDataColumn: {
    marginBottom: 8,
  },
  pitDataLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  pitDataValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pitDataText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginLeft: 24,
  },
  pitDataBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pitDataBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pitDataDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 8,
  },
  matchScoutingContainer: {
    marginBottom: 16,
  },
  matchScoutingCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  matchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  matchDate: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  matchDataSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  matchDataSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  matchDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matchDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '45%',
    marginBottom: 4,
  },
  matchDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchDataLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
    minWidth: 60,
  },
  matchDataValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchDataText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  matchDataBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  matchDataBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
