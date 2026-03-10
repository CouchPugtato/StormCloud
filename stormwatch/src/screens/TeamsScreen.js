import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { globalStyles } from '../styles/globalStyles';
import { platformUtils } from '../utils/platformUtils';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

const sampleTeams = [
  {
    id: 254,
    name: 'The Cheesy Poofs',
    location: 'San Jose, CA',
    rookieYear: 1999,
    awards: 47,
    championships: 3,
    logo: '🧀',
    events: ['Silicon Valley Regional', 'Championship - Houston', 'Sacramento Regional'],
  },
  {
    id: 1678,
    name: 'Citrus Circuits',
    location: 'Davis, CA',
    rookieYear: 2005,
    awards: 32,
    championships: 1,
    logo: '🍊',
    events: ['Sacramento Regional', 'Championship - Houston', 'Central Valley Regional'],
  },
  {
    id: 148,
    name: 'Robowranglers',
    location: 'Greenville, TX',
    rookieYear: 1996,
    awards: 28,
    championships: 2,
    logo: '🤠',
    events: ['Dallas Regional', 'Championship - Houston', 'Lone Star Regional'],
  },
  {
    id: 1323,
    name: 'MadTown Robotics',
    location: 'Madison, WI',
    rookieYear: 2004,
    awards: 25,
    championships: 1,
    logo: '🧪',
    events: ['Wisconsin Regional', 'Championship - Detroit', 'Great Lakes Regional'],
  },
  {
    id: 2056,
    name: 'OP Robotics',
    location: 'Overland Park, KS',
    rookieYear: 2007,
    awards: 18,
    championships: 0,
    logo: '⚡',
    events: ['Kansas City Regional', 'Championship - Houston', 'Midwest Regional'],
  },
  {
    id: 973,
    name: 'Greybots',
    location: 'Atascadero, CA',
    rookieYear: 2002,
    awards: 22,
    championships: 1,
    logo: '🤖',
    events: ['Central Valley Regional', 'Championship - Houston', 'Los Angeles Regional'],
  },
  {
    id: 1114,
    name: 'Simbotics',
    location: 'St. Catharines, ON',
    rookieYear: 2003,
    awards: 35,
    championships: 2,
    logo: '🍁',
    events: ['Ontario Regional', 'Championship - Detroit', 'Greater Toronto Regional'],
  },
  {
    id: 2767,
    name: 'Stryke Force',
    location: 'Kalamazoo, MI',
    rookieYear: 2009,
    awards: 15,
    championships: 0,
    logo: '⚔️',
    events: ['Michigan Regional', 'Championship - Detroit', 'Great Lakes Regional'],
  },
  {
    id: 118,
    name: 'The Robonauts',
    location: 'Houston, TX',
    rookieYear: 1996,
    awards: 30,
    championships: 1,
    logo: '🚀',
    events: ['Houston Regional', 'Championship - Houston', 'Lone Star Regional'],
  },
  {
    id: 1619,
    name: 'Up-A-Creek Robotics',
    location: 'Maggie Valley, NC',
    rookieYear: 2005,
    awards: 12,
    championships: 0,
    logo: '🏔️',
    events: ['North Carolina Regional', 'Championship - Houston', 'Smoky Mountains Regional'],
  },
];

const getAllEvents = () => {
  const events = new Set();
  sampleTeams.forEach(team => {
    team.events.forEach(event => events.add(event));
  });
  return Array.from(events).sort();
};

export default function TeamsScreen({ navigation }) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('All Events');
  const [showFilters, setShowFilters] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const allEvents = useMemo(() => ['All Events', ...getAllEvents()], []);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);
        const teamsData = await apiService.getAllTeams();
        setTeams(teamsData || []); 
      } catch (err) {
        console.error('Failed to fetch teams:', err);
        setError('Failed to load teams. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const searchTeams = async () => {
      if (searchQuery.trim() === '') {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await apiService.searchTeams(searchQuery);
        setSearchResults(results || []); 
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchTeams, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredTeams = useMemo(() => {
    const sourceTeams = searchQuery.trim() !== '' ? searchResults : teams;
    let filtered = sourceTeams || []; 

    if (selectedEvent !== 'All Events') {
      filtered = sourceTeams || [];
    }

    return filtered;
  }, [searchQuery, searchResults, teams, selectedEvent]);

  const renderTeamItem = ({ item }) => {
    const teamNumber = item.team_num || item.id;
    const teamName = item.name;
    const teamLocation = item.city && item.state 
      ? `${item.city}, ${item.state}` 
      : item.location || 'Location not available';
    
    return (
      <TouchableOpacity
        style={[styles.teamItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => navigation.navigate('TeamDetail', { 
          team: {
            ...item,
            id: teamNumber,
            team_key: item.team_key || `frc${teamNumber}`
          }
        })}
        activeOpacity={0.7}
      >
        <View style={styles.teamRow}>
          <Text style={[styles.teamNumber, { color: theme.colors.accent }]}>{teamNumber}</Text>
          <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
          <View style={styles.teamInfo}>
            <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1}>{teamName}</Text>
            <Text style={[styles.teamLocation, { color: theme.colors.textSecondary }]} numberOfLines={1}>{teamLocation}</Text>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.colors.textSecondary} 
            style={styles.chevron}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventFilter = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
        selectedEvent === item && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
      ]}
      onPress={() => setSelectedEvent(item)}
    >
      <Text style={[
        styles.filterChipText,
        { color: theme.colors.text },
        selectedEvent === item && { color: '#fff' }
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={theme.colors.statusBar} 
      />
      
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>Teams</Text>
        <Text style={styles.headerSubtitle}>
          {filteredTeams?.length || 0} teams found
        </Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background }]}>
          {isSearching ? (
            <ActivityIndicator size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          ) : (
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          )}
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search by team number or name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
            selectionColor={theme.colors.accent}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.filterButton, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons 
            name={showFilters ? "filter" : "filter-outline"} 
            size={20} 
            color={showFilters ? theme.colors.accent : theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={[styles.filtersContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Filter by Event:</Text>
          <FlatList
            data={allEvents}
            renderItem={renderEventFilter}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersList}
          />
        </View>
      )}

      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading teams...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTeams}
          renderItem={renderTeamItem}
          keyExtractor={(item) => (item.team_num || item.id).toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          ListEmptyComponent={() => (
            <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>No teams found</Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>Try adjusting your search or filters</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: platformUtils.getStatusBarHeight() + 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e3f2fd',
    opacity: 0.9,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#fff',
    ...platformUtils.getPlatformShadow(1),
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212529',
    outlineStyle: 'none',
  },
  filterButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    ...platformUtils.getPlatformShadow(1),
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 10,
  },
  filtersList: {
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  filterChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  teamItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...platformUtils.getPlatformShadow(1),
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    minWidth: 60,
  },
  separator: {
    width: 2,
    height: 20,
    backgroundColor: '#dee2e6',
    marginHorizontal: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  chevron: {
    marginLeft: 8,
  },
  teamLocation: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '400',
  },
  itemSeparator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 50,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#212529',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#2196F3',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
