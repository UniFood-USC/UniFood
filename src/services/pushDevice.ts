import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  AndroidImportance, getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync,
  scheduleNotificationAsync, setNotificationChannelAsync, setNotificationHandler,
} from 'expo-notifications';
import type { Device } from '../domain/notifications';

const mobile = Platform.OS === 'ios' || Platform.OS === 'android';

let handlerReady = false;

// Permiso para mostrar avisos. En Android 13+ solo se pide después de crear un canal.
// Con la app abierta el aviso también se muestra como banner.
async function allowNotices() {
  if (!handlerReady) {
    setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    handlerReady = true;
  }
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('avisos', { name: 'Avisos de pedidos', importance: AndroidImportance.HIGH });
  }
  const current = await getPermissionsAsync();
  return (current.status === 'granted' ? current.status : (await requestPermissionsAsync()).status) === 'granted';
}

// Token push de este dispositivo, o null si no se puede obtener: web, permiso denegado,
// proyecto sin identificador de EAS o fallo de red. Nunca impide usar la app; la bandeja
// sigue mostrando los avisos aunque no lleguen como push.
export async function currentPushDevice(): Promise<Device | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!mobile || !projectId) return null;
  try {
    if (!await allowNotices()) return null;
    const { data } = await getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS as Device['platform'] };
  } catch {
    return null;
  }
}

// Aviso local inmediato; funciona en Expo Go. Sin permiso o en web no muestra nada.
export async function showLocalNotice(title: string, body: string) {
  if (!mobile) return;
  try {
    if (await allowNotices()) await scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch { /* el aviso sigue en la bandeja */ }
}
