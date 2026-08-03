import { supabaseClient } from './supabase.js';

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export async function scanBinderPage(imageDataUrl) {
  const { data, error } = await supabaseClient.functions.invoke('scan-binder-page', {
    body: { image: imageDataUrl },
  });
  if (error) throw error;
  return data?.cards || [];
}
