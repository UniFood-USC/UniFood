// Contrato compartido; declarar un código no implementa la operación de ese módulo.
const resultKinds = {
  OK: 'exito', EN_PROCESO: 'pendiente', CONFIRMACION_INCIERTA: 'pendiente',
  CORREO_EN_USO: 'conflicto', CONFLICTO_VERSION: 'conflicto', CONFLICTO_PROMOCION: 'conflicto',
  REQUIERE_REVISION: 'conflicto', SIN_CUPO: 'conflicto',
  VALIDACION: 'error', CREDENCIALES_INVALIDAS: 'error', SESION_REQUERIDA: 'error',
  NO_AUTORIZADO: 'error', ACCESO_BLOQUEADO: 'error', SERVICIO_NO_DISPONIBLE: 'error',
  RECUPERACION_INVALIDA: 'error', RESTAURANTE_CERRADO: 'error', DESTINO_NO_DISPONIBLE: 'error',
  PAGO_FALLIDO: 'error', TRANSICION_INVALIDA: 'error', MINIMO_ADMINISTRADORES: 'error',
} as const;
export type ResultCode = keyof typeof resultKinds;
export type ServiceResponse<T = unknown> = {
  resultado: 'exito' | 'error' | 'conflicto' | 'pendiente';
  codigo: ResultCode;
  mensaje: string;
  datos: T | null;
  recuperable: boolean;
};
export function response<T = never>(codigo: ResultCode, mensaje: string, datos: T | null = null, recuperable = false): ServiceResponse<T> {
  const resultado = resultKinds[codigo];
  return { resultado, codigo, mensaje, datos, recuperable };
}

export function isServiceResponse(value: unknown): value is ServiceResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.codigo === 'string' && Object.hasOwn(resultKinds, data.codigo)
    && data.resultado === resultKinds[data.codigo as ResultCode]
    && typeof data.mensaje === 'string' && typeof data.recuperable === 'boolean'
    && Object.hasOwn(data, 'datos');
}
