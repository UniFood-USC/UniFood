import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { Pressable, Text } from 'react-native';
import { SessionProvider, useSession } from '../features/identity/SessionProvider';

export default function RootLayout() {
  return <SessionProvider><Navigator /></SessionProvider>;
}

function Navigator() {
  const { identity, logout } = useSession();
  const headerRight = () => <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión"
    onPress={() => { void logout(); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
    <Text style={{ color: colors.primary, fontWeight: '600' }}>Cerrar sesión</Text>
  </Pressable>;
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="register" options={{ title: 'Crear cuenta', headerShown: false }} />
    <Stack.Protected guard={identity?.role === 'student'}>
      <Stack.Screen name="student" options={{ title: 'Estudiante', headerRight }} />
      <Stack.Screen name="order/[id]" />
    </Stack.Protected>
    <Stack.Protected guard={identity?.role === 'restaurant'}>
      <Stack.Screen name="restaurant" options={{ title: 'Restaurante', headerRight }} />
    </Stack.Protected>
    <Stack.Protected guard={identity?.role === 'admin'}>
      <Stack.Screen name="admin" options={{ title: 'Administrador', headerRight }} />
    </Stack.Protected>
  </Stack></>;
}
