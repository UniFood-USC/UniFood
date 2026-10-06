export const createClock = (read = Date.now) => ({ now: () => new Date(read()) });
export const colombiaTime = (instant: Date) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(instant);
