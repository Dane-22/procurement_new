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
import PRReviewScreen from './screens/PRReviewScreen';
import ApprovalsScreen from './screens/ApprovalsScreen';
import ProcessPRScreen from './screens/ProcessPRScreen';
import CreateSupplierScreen from './screens/CreateSupplierScreen';
import { initDB, setupNetworkListener } from './services/offlineSync';
import { AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NavigationTheme, colors } from './theme';

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
          } else if (route.name === 'Approvals') {
            iconName = 'check-circle-outline';
          }

          return <MaterialIcons name={iconName} size={focused ? 28 : 24} color={color} />;
        },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          backgroundColor: colors.surface,
        },
        headerStyle: { backgroundColor: colors.primary, elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.secondary,
        headerTitleStyle: { fontWeight: '800' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Requests" component={PRManagementScreen} options={{ headerTitle: 'All Requests' }} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ headerTitle: 'Approvals' }} />
      <Tab.Screen name="New Request" component={CreateRequestScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

import { usePushNotifications } from './hooks/usePushNotifications';
import ErrorBoundary from './components/ErrorBoundary';

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
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, setUser }}>
        <SocketProvider>
          <NavigationContainer theme={NavigationTheme}>
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
                options={{ title: 'Purchase Request Details' }}
              />
              <Stack.Screen 
                name="PRReview" 
                component={PRReviewScreen} 
                options={{ title: 'Review Request' }}
              />
              <Stack.Screen 
                name="ProcessPR" 
                component={ProcessPRScreen} 
                options={{ title: 'Process Request' }}
              />
              <Stack.Screen 
                name="EditRequest" 
                component={CreateRequestScreen} 
                options={{ title: 'Edit Request' }}
              />
              <Stack.Screen 
                name="CreateSupplier" 
                component={CreateSupplierScreen} 
                options={{ title: 'Add New Supplier' }}
              />
            </Stack.Navigator>
          )}
          <StatusBar style="auto" />
        </NavigationContainer>
      </SocketProvider>
    </AuthContext.Provider>
    </ErrorBoundary>
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
