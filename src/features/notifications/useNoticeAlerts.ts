import { useEffect } from 'react';
import type { Notice } from '../../domain/notifications';
import type { ServiceResponse } from '../../domain/response';

type Service = (action: 'notifications/list', input: unknown) => Promise<ServiceResponse>;
type Notify = (title: string, body: string) => Promise<void>;

// RF-12, RF-17 · Mientras la app está abierta consulta la bandeja cada cierto tiempo y muestra
// cada aviso nuevo como notificación del teléfono (funciona en Expo Go, iOS y Android).
// Los avisos que ya existían al entrar no suenan; con la app cerrada no llega nada.
export function useNoticeAlerts(service: Service, notify: Notify, intervalMs = 30000) {
  useEffect(() => {
    let active = true;
    let seen: Set<string> | null = null;
    async function check() {
      try {
        const result = await service('notifications/list', {});
        if (!active || result.codigo !== 'OK') return;
        const notices = (result.datos as { notices: Notice[] }).notices;
        if (seen) for (const notice of notices.filter(item => !seen!.has(item.id))) await notify(notice.title, notice.message);
        seen = new Set([...(seen ?? []), ...notices.map(item => item.id)]);
      } catch { /* sin conexión: se intenta en la siguiente vuelta */ }
    }
    void check();
    const timer = setInterval(() => { void check(); }, intervalMs);
    return () => { active = false; clearInterval(timer); };
  }, [service, notify, intervalMs]);
}
