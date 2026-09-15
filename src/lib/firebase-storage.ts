import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadUserFile(uid: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `users/${uid}/files/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  return {
    path,
    name: file.name,
    size: file.size,
    contentType: file.type,
    downloadURL,
  };
}

export async function deleteUserFile(path: string) {
  return deleteObject(ref(storage, path));
}
