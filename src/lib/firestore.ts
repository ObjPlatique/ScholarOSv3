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
  | "aiQuizzes";

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

export async function listAIConversations(uid: string, type?: AIConversation["type"]) {
  const conversations = await listUserDocuments<AIConversation>(uid, "aiConversations");
  return conversations
    .filter((item) => !type || item.type === type)
    .sort((a, b) => {
      const aTime = typeof (a.updatedAt as { toMillis?: () => number } | undefined)?.toMillis === "function" ? (a.updatedAt as { toMillis: () => number }).toMillis() : 0;
      const bTime = typeof (b.updatedAt as { toMillis?: () => number } | undefined)?.toMillis === "function" ? (b.updatedAt as { toMillis: () => number }).toMillis() : 0;
      return bTime - aTime;
    });
}

export async function createAIConversation(uid: string, data: Omit<AIConversation, "id" | "createdAt" | "updatedAt">) {
  return createUserDocument(uid, "aiConversations", data);
}

export async function addAIMessage(uid: string, conversationId: string, data: Omit<AIMessage, "id" | "createdAt">) {
  const cleanData = sanitizeData(data) as DocumentData;
  return addDoc(collection(db, "users", uid, "aiConversations", conversationId, "messages"), {
    ...cleanData,
    createdAt: serverTimestamp(),
  });
}

export async function listAIMessages(uid: string, conversationId: string) {
  const snapshot = await getDocs(collection(db, "users", uid, "aiConversations", conversationId, "messages"));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as AIMessage)
    .sort((a, b) => {
      const aTime = typeof (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis === "function" ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
      const bTime = typeof (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis === "function" ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
      return aTime - bTime;
    });
}

export async function deleteAIConversation(uid: string, conversationId: string) {
  const messagesRef = collection(db, "users", uid, "aiConversations", conversationId, "messages");
  const snapshot = await getDocs(messagesRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(doc(db, "users", uid, "aiConversations", conversationId));
  await batch.commit();
}
