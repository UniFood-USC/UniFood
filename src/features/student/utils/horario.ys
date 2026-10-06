import { DiaSemana, Horario } from "../types/restaurante";

const DIAS: DiaSemana[] = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];
const NOMBRES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

// Campus Pampalinda (Cali): UTC-5 todo el año, sin horario de verano.
const OFFSET_MINUTOS = -5 * 60;

function aHoraCampus(fecha: Date) {
  const local = new Date(fecha.getTime() + OFFSET_MINUTOS * 60000);
  return {
    dia: local.getUTCDay(), // 0 = domingo
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** true si el restaurante atiende en este momento. */
export function estaAbierto(horario?: Horario, ahora: Date = new Date()): boolean {
  if (!horario) return false;
  const { dia, minutos } = aHoraCampus(ahora);
  const tramo = horario[DIAS[dia]];
  if (!tramo) return false;
  return minutos >= aMinutos(tramo.abre) && minutos < aMinutos(tramo.cierra);
}

/** Texto con la próxima apertura: "Hoy 14:00", "Mañana 08:00", "Lunes 08:00". */
export function calcularProximaApertura(
  horario?: Horario,
  ahora: Date = new Date()
): string | undefined {
  if (!horario) return undefined;
  const { dia, minutos } = aHoraCampus(ahora);

  for (let i = 0; i <= 7; i++) {
    const idx = (dia + i) % 7;
    const tramo = horario[DIAS[idx]];
    if (!tramo) continue;
    if (i === 0 && aMinutos(tramo.abre) <= minutos) continue; // ya pasó hoy
    const etiqueta = i === 0 ? "Hoy" : i === 1 ? "Mañana" : NOMBRES[idx];
    return `${etiqueta} ${tramo.abre}`;
  }
  return undefined;
}
