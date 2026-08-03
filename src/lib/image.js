// Resizes an image file client-side and returns a JPEG data URL, capped to
// maxDim on the longest edge. Used both for per-card photo uploads (small,
// maxDim ~500) and binder-page scans (larger, maxDim 1568 — Anthropic's own
// documented sweet spot for Claude's vision input, since anything bigger
// just gets downscaled server-side anyway with no accuracy benefit, and an
// unresized iPhone photo can comfortably exceed their 10MB request limit).
export function resizeImageFile(file, maxDim, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const image = new Image();
      image.onload = () => {
        let w = image.width, h = image.height;
        if (w > h && w > maxDim) { h = h * maxDim / w; w = maxDim; }
        else if (h > maxDim) { w = w * maxDim / h; h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(image, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = () => reject(new Error("Couldn't read that image."));
      image.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
