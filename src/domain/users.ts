import type { UserRole } from '../types/domain';
export type ManagedUser = {
  id: string; name: string; email: string; role: UserRole;
  state: 'active' | 'suspended' | 'deleted'; version: number;
  pendingContact?: { name: string; email: string };
};
export const roleLabels = { student: 'Estudiante', restaurant: 'Restaurante', admin: 'Administrador' } as const;
export const stateLabels = { active: 'Activo', suspended: 'Suspendido', deleted: 'Eliminado' } as const;
