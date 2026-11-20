/* Imhotep · daily progress backup (CLI). Run from the GitHub Actions workflow "Firebase" (action: backup; it also runs every day on its own).
   Needs (as a repository SECRET, never in a file): FIREBASE_SERVICE_ACCOUNT (the whole JSON). Prints counts only. Never upload its output as an artifact (the repo is public). */
import { runBackup } from './backup-core.mjs';

let sa; try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT secret must be the service-account JSON'); process.exit(2); }
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();
console.log('Firebase project: ' + sa.project_id + ' · backup');
let R;
try { R = await runBackup({ db, FV: FieldValue, log: console.log }); }
catch (e) { console.error('Backup stopped: ' + String((e && (e.code || e.name)) || 'error').slice(0, 60) + ' (nothing sensitive is printed; re-run is safe)'); process.exit(1); }
process.exit(R.ok ? 0 : 1);
