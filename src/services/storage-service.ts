'use server';

import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase';

const storage = getStorage(app);

/**
 * Uploads a base64 encoded data URI to Firebase Storage.
 * @param dataUrl The data URI string (e.g., 'data:image/png;base64,...').
 * @param path The path in Firebase Storage to upload the file to.
 * @returns A promise that resolves to the public download URL of the uploaded file.
 */
export async function uploadDataUrlToStorage(dataUrl: string, path: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL provided.');
  }
  
  const storageRef = ref(storage, path);
  
  // 'data_url' is the format Firebase expects for data URI uploads.
  // The uploadString function correctly handles parsing the metadata and base64 data.
  const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
  
  // Get the public URL for the uploaded file.
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
}
