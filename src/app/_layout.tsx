import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';

export default function RootLayout() {
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
    <Stack.Screen name="index" options={{ title: 'UniFood' }} />
    <Stack.Screen name="student" options={{ title: 'Estudiante' }} />
    <Stack.Screen name="restaurant" options={{ title: 'Restaurante' }} />
    <Stack.Screen name="admin" options={{ title: 'Administrador' }} />
  </Stack></>;
}
