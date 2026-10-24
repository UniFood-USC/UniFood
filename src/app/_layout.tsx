import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { SessionProvider, useSession } from '../features/identity/SessionProvider';

export default function RootLayout() {
  return <SessionProvider><Navigator /></SessionProvider>;
}

// Cada rol tiene su grupo de pestañas; las pantallas de detalle se abren encima, con la misma protección.
function Navigator() {
  const { identity } = useSession();
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="register" options={{ title: 'Crear cuenta', headerShown: false }} />
    <Stack.Screen name="recover" options={{ headerShown: false }} />
    <Stack.Screen name="reset" options={{ headerShown: false }} />
    <Stack.Protected guard={identity?.role === 'student'}>
      <Stack.Screen name="student" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="restaurants" />
    </Stack.Protected>
    <Stack.Protected guard={identity?.role === 'restaurant'}>
      <Stack.Screen name="restaurant" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={identity?.role === 'admin'}>
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack.Protected>
  </Stack></>;
}
