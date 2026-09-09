import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import PRManagementScreen from './screens/PRManagementScreen';
import PRDetailScreen from './screens/PRDetailScreen';
import CreateRequestScreen from './screens/CreateRequestScreen';
import ProfileScreen from './screens/ProfileScreen';
import { initDB, setupNetworkListener } from './services/offlineSync';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'Requests') {
            iconName = 'assignment';
          } else if (route.name === 'New Request') {
            iconName = 'add-circle-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <MaterialIcons name={iconName} size={focused ? 28 : 24} color={color} />;
        },
        tabBarActiveTintColor: '#1E293B',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          elevation: 0,
          shadowOpacity: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          backgroundColor: '#ffffff',
        },
        headerStyle: { backgroundColor: '#FFBF00', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: '800' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Requests" component={PRManagementScreen} options={{ headerTitle: 'All Requests' }} />
      <Tab.Screen name="New Request" component={CreateRequestScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

import { usePushNotifications } from './hooks/usePushNotifications';

export default function App() {
  const [user, setUser] = useState(null);
  const { expoPushToken, notification } = usePushNotifications(user);

  useEffect(() => {
    initDB();
    const unsubscribe = setupNetworkListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer>
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLoginSuccess={setUser} />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="PRDetail" 
            component={PRDetailScreen} 
            options={{ title: 'PR Details' }}
          />
          <Stack.Screen 
            name="EditRequest" 
            component={CreateRequestScreen} 
            options={{ title: 'Edit Request' }}
          />
        </Stack.Navigator>
      )}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
