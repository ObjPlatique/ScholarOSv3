import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

export type UserDocument = {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

const collectionRef = (uid: string, name: ScholarCollection) =>
  collection(db, "users", uid, name);

/** Remove undefined values before sending data to Firestore.
 * This keeps optional fields consistent across all modules and avoids
 * Firestore write failures caused by accidental undefined values.
 */
function sanitizeData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeData);
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = sanitizeData(item);
    }
    return result;
  }

  return value;
}

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

export async function getUserDocument<T extends DocumentData>(
  uid: string,
  name: ScholarCollection,
  id: string,
) {
  const snapshot = await getDoc(doc(db, "users", uid, name, id));
  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T & { id: string };
}

export async function createUserDocument(
  uid: string,
  name: ScholarCollection,
  data: DocumentData,
) {
  const cleanData = sanitizeData(data) as DocumentData;
  return addDoc(collectionRef(uid, name), {
    ...cleanData,
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
  const cleanData = sanitizeData(data) as DocumentData;
  return updateDoc(doc(db, "users", uid, name, id), {
    ...cleanData,
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
