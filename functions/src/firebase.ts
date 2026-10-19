import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function adminServices() {
  const app = getApps()[0] ?? initializeApp();
  return { auth: getAuth(app), db: getFirestore(app) };
}
