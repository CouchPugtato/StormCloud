import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, USER_ROLES } from '../contexts/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import TeamsScreen from '../screens/TeamsScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import CommsScreen from '../screens/CommsScreen';
import PickListScreen from '../screens/PickListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ControlDashboardScreen from '../screens/ControlDashboardScreen';
import PlatformDemoScreen from '../screens/PlatformDemoScreen';
import MatchScoutingForm from '../components/MatchScoutingForm';
import AllianceScoutingForm from '../components/AllianceScoutingForm';
import PitScoutingForm from '../components/PitScoutingForm';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
      />
      <Stack.Screen 
        name="PlatformDemo" 
        component={PlatformDemoScreen} 
      />
      <Stack.Screen 
        name="MatchScoutingForm" 
        component={MatchScoutingForm} 
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllianceScoutingForm"
        component={AllianceScoutingForm}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function TeamsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="TeamsMain" 
        component={TeamsScreen} 
      />
      <Stack.Screen 
        name="TeamDetail" 
        component={TeamDetailScreen} 
      />
      <Stack.Screen 
        name="PitScoutingForm" 
        component={PitScoutingForm} 
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const canViewPickList = user?.role && user.role !== USER_ROLES.VIEWER;
  const canViewControlDashboard = user?.role === USER_ROLES.SCOUTING_LEAD;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Teams') {
            iconName = focused ? 'people' : 'people-outline';
          } /* else if (route.name === 'Comms') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } */ else if (route.name === 'PickList') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'ControlDashboard') {
            iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Teams" component={TeamsStack} />
      {/* <Tab.Screen name="Comms" component={CommsScreen} /> */}
      {canViewPickList && (
        <Tab.Screen name="PickList" component={PickListScreen} options={{ title: 'Pick List' }} />
      )}
      {canViewControlDashboard && (
        <Tab.Screen name="ControlDashboard" component={ControlDashboardScreen} options={{ title: 'Control Dashboard' }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
}
