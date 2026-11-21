import { callService } from '../../services/client';
import { showLocalNotice } from '../../services/pushDevice';
import { useNoticeAlerts } from './useNoticeAlerts';

// Se monta solo con la sesión de estudiante o restaurante.
export function NoticeAlerts() {
  useNoticeAlerts(callService, showLocalNotice);
  return null;
}
