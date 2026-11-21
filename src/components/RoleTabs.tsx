import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '../constants/theme';

type Tab = { name: string; title: string; icon: ComponentProps<typeof Feather>['name']; header?: boolean };

// Barra inferior común. Cada rol declara sus pestañas en su layout (docs: navegación por rol).
export function RoleTabs({ tabs }: { tabs: Tab[] }) {
  return <Tabs screenOptions={{
    tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface },
    headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink, headerShadowVisible: false,
  }}>
    {tabs.map(({ name, title, icon, header = true }) => <Tabs.Screen key={name} name={name} options={{
      title, headerShown: header, tabBarIcon: ({ color, size }) => <Feather name={icon} color={String(color)} size={size} />,
    }} />)}
  </Tabs>;
}
