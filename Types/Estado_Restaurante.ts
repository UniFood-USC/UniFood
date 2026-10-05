export type EstadoRestaurante =
  | "aprobado"
  | "pendiente"
  | "suspendido"
  | "eliminado";

export type DiaSemana =
  | "domingo" | "lunes" | "martes" | "miercoles"
  | "jueves" | "viernes" | "sabado";

export interface Tramo {
  abre: string;   // "08:00"
  cierra: string; // "18:00"
}

// null o ausente = no atiende ese día
export type Horario = Partial<Record<DiaSemana, Tramo | null>>;

// Documento tal como está en Firestore: colección "restaurantes"
export interface RestauranteDoc {
  nombre: string;
  logo?: string;
  estado: EstadoRestaurante;
  activo: boolean;
  horario?: Horario;
  // ...otros campos privados (dueño, correo, etc.) que NO se exponen
}

// Lo único que ve el estudiante (RF-04)
export interface RestaurantePublico {
  id: string;
  nombre: string;
  logo?: string;
  disponible: boolean;          // true si atiende ahora
  proximaApertura?: string;     // solo si está cerrado. Ej: "Mañana 08:00"
}
