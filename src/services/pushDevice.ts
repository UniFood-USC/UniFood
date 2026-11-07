import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AndroidImportance, getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync, setNotificationChannelAsync } from 'expo-notifications';
import type { Device } from '../domain/notifications';

// Token push de este dispositivo, o null si no se puede obtener: web, permiso denegado,
// proyecto sin identificador de EAS o fallo de red. Nunca impide usar la app; la bandeja
// sigue mostrando los avisos aunque no lleguen como push.
export async function currentPushDevice(): Promise<Device | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !projectId) return null;
  try {
    // En Android 13+ el permiso solo se pide después de crear un canal.
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('avisos', { name: 'Avisos de pedidos', importance: AndroidImportance.HIGH });
    }
    const current = await getPermissionsAsync();
    const status = current.status === 'granted' ? current.status : (await requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const { data } = await getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS };
  } catch {
    return null;
  }
}
