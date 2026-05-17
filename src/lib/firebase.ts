import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

export const signUpWithEmail = (email: string, pass: string, name: string) => 
  createUserWithEmailAndPassword(auth, email, pass).then(async (res) => {
    await updateProfile(res.user, { displayName: name });
    return res;
  });

export const loginWithEmail = (email: string, pass: string) => 
  signInWithEmailAndPassword(auth, email, pass);
