import type { UserRole } from '../types/domain';

export type RegistrationInput = { name: string; email: string; password: string; confirmPassword: string };
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validateContact(input: unknown, role: UserRole) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisa los campos del registro.');
  const data = input as Record<string, unknown>;
  if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('Escribe tu nombre completo.');
  if (typeof data.email !== 'string') throw new Error('Escribe un correo válido.');
  const email = normalizeEmail(data.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo válido.');
  if (role === 'student' && email.split('@')[1] !== 'usc.edu.co') throw new Error('Usa tu correo institucional @usc.edu.co.');
  return { name: data.name.trim(), email };
}

export function validateRegistration(input: unknown, role: UserRole) {
  const contact = validateContact(input, role);
  const data = input as Record<string, unknown>;
  if (typeof data.password !== 'string' || data.password.length < 8 || !/\p{L}/u.test(data.password) || !/[0-9]/.test(data.password)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres, una letra y un número.');
  }
  if (data.password !== data.confirmPassword) throw new Error('Las contraseñas no coinciden.');
  return { ...contact, password: data.password };
}
