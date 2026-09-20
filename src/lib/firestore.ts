import {
  addDoc,
  collection,
  deleteDoc,
  writeBatch,
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
  | "userSettings"
  | "aiConversations"
  | "aiQuizzes"
  | "aiPlans"
  | "aiAnswerGrades"
  | "errorLogs";

export type UserDocument = {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

const collectionRef = (uid: string, name: ScholarCollection) =>
  collection(db, "users", uid, name);

function sanitizeData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeData);
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
  return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
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

export type AIConversation = {
  id: string;
  type: "study-assistant" | "chat";
  title: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type AIMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt?: unknown;
};

export async function listAIConversations(uid: string) {
  return listUserDocuments<AIConversation>(uid, "aiConversations");
}

export async function createAIConversation(
  uid: string,
  data: Omit<AIConversation, "id" | "createdAt" | "updatedAt">,
) {
  return createUserDocument(uid, "aiConversations", data);
}

export async function addAIMessage(
  uid: string,
  conversationId: string,
  data: Omit<AIMessage, "id" | "createdAt">,
) {
  const messagesRef = collection(
    db,
    "users",
    uid,
    "aiConversations",
    conversationId,
    "messages",
  );
  return addDoc(messagesRef, { ...data, createdAt: serverTimestamp() });
}

export async function listAIMessages(uid: string, conversationId: string) {
  const messagesRef = collection(
    db,
    "users",
    uid,
    "aiConversations",
    conversationId,
    "messages",
  );
  const snapshot = await getDocs(messagesRef);
  return snapshot.docs.map((item: QueryDocumentSnapshot) => ({
    id: item.id,
    ...item.data(),
  })) as Array<AIMessage & { id: string }>;
}

export async function deleteAIConversation(
  uid: string,
  conversationId: string,
) {
  const messagesRef = collection(
    db,
    "users",
    uid,
    "aiConversations",
    conversationId,
    "messages",
  );
  const messageSnapshot = await getDocs(messagesRef);
  const batch = writeBatch(db);

  messageSnapshot.docs.forEach((message) => batch.delete(message.ref));
  batch.delete(doc(db, "users", uid, "aiConversations", conversationId));

  return batch.commit();
}
