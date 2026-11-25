export type EstadoRestaurante =
  | "aprobado"
  | "pendiente"
  | "rechazado"
  | "suspendido"
  | "eliminado";

export type DiaSemana =
  | "domingo" | "lunes" | "martes" | "miercoles"
  | "jueves" | "viernes" | "sabado";

// "cierra" menor que "abre" (p. ej. 18:00 → 02:00) es una franja que cruza la medianoche:
// pertenece al día en que abre y termina en la madrugada del día siguiente.
export interface Tramo {
  abre: string;   // "08:00"
  cierra: string; // "18:00"
}

// null o ausente = no atiende ese día
export type Horario = Partial<Record<DiaSemana, Tramo | null>>;

// Cierre especial: el establecimiento no atiende ese día completo (fecha de Colombia, AAAA-MM-DD).
export interface CierreEspecial {
  fecha: string;
  motivo?: string;
}

// Cierre temporal: cerrado hasta el instante de reapertura (ISO). Al llegar ese instante
// la operación vuelve sola al horario habitual.
export interface CierreTemporal {
  hasta: string;
  desde?: string;
  motivo?: string;
}

// Documento tal como está en Firestore: colección "restaurantes"
export interface RestauranteDoc {
  nombre: string;
  logo?: string;
  estado: EstadoRestaurante;
  activo: boolean;
  horario?: Horario;
  cierresEspeciales?: CierreEspecial[];
  cierreTemporal?: CierreTemporal | null;
  // Campos de gestión (RF-22). Privados: solo los ven el administrador y el propietario.
  descripcion?: string;
  ubicacion?: string;
  telefono?: string;
  correo?: string;
  ownerId?: string;
  motivoRechazo?: string | null;
  version?: number;
}

// Lo único que ve el estudiante (RF-04)
export interface RestaurantePublico {
  id: string;
  nombre: string;
  logo?: string;
  disponible: boolean;          // true si atiende ahora
  proximaApertura?: string;     // solo si está cerrado. Ej: "Mañana 08:00"
  cierreTemporal?: boolean;     // true si está cerrado temporalmente (proximaApertura es la reapertura)
}
