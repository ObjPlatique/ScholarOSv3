import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export type ScholarCollection =
  | "tasks"
  | "habits"
  | "schedule"
  | "notes"
  | "files"
  | "userSettings";

const collectionRef = (uid: string, name: ScholarCollection) =>
  collection(db, "users", uid, name);

export async function listUserDocuments<T extends DocumentData>(
  uid: string,
  name: ScholarCollection,
) {
  const snapshot = await getDocs(collectionRef(uid, name));
  return snapshot.docs.map((item: QueryDocumentSnapshot) => ({
    id: item.id,
    ...item.data(),
  })) as Array<T & { id: string }>;
}

export async function createUserDocument(
  uid: string,
  name: ScholarCollection,
  data: DocumentData,
) {
  return addDoc(collectionRef(uid, name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserDocument(
  uid: string,
  name: ScholarCollection,
  id: string,
  data: DocumentData,
) {
  return updateDoc(doc(db, "users", uid, name, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserDocument(
  uid: string,
  name: ScholarCollection,
  id: string,
) {
  return deleteDoc(doc(db, "users", uid, name, id));
}
