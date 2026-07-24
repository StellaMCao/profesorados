import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyApnry6P-cqExRl_ev5DC3xGfDoPyH5oWE",
  authDomain: "glosa-app-21706.firebaseapp.com",
  projectId: "glosa-app-21706",
  storageBucket: "glosa-app-21706.firebasestorage.app",
  messagingSenderId: "349723879165",
  appId: "1:349723879165:web:71c1891169c49328c4c094"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export {
  db, storage, auth, googleProvider,
  collection, addDoc, onSnapshot, query, orderBy,
  doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
  signInWithPopup, signOut, onAuthStateChanged
};
