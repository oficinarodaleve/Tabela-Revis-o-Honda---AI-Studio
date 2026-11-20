import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createSafeAuth(): Auth {
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  }
}

export const auth = createSafeAuth();
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
