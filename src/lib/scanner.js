import { supabaseClient } from './supabase.js';
import { resizeImageFile } from './image.js';

// 1568px matches Claude's own documented sweet spot for vision input — large
// enough to keep 9 cards' worth of text/set symbols legible, comfortably
// under Anthropic's 10MB request limit (an unresized iPhone photo can exceed
// that on its own), and anything bigger just gets downscaled server-side
// with no accuracy benefit anyway.
export function readBinderPagePhoto(file) {
  return resizeImageFile(file, 1568, 0.85);
}

export async function scanBinderPage(imageDataUrl) {
  const { data, error } = await supabaseClient.functions.invoke('scan-binder-page', {
    body: { image: imageDataUrl },
  });
  if (error) throw error;
  return data?.cards || [];
}
