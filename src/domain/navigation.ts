export function roleDestination(role: string) {
  if (role === 'student') return '/student' as const;
  if (role === 'restaurant') return '/restaurant' as const;
  if (role === 'admin') return '/admin' as const;
  return null;
}
