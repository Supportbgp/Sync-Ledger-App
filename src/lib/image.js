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

// Crops one rectangular region out of a full data-URL image, given a
// bounding box as fractions (0.0-1.0) of the source image's width/height —
// the shape the binder scanner's vision model reports per detected card
// (see scan-binder-page's DETECT_CARDS_TOOL). This is how a single
// binder-page photo becomes each card's own "real photo" reference with no
// second upload. Output is capped to maxDim same as resizeImageFile, since
// a crop out of a full-page photo is still a large image.
export function cropImageRegion(dataUrl, bbox, maxDim = 500, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sx = Math.max(0, bbox.x_min) * image.width;
      const sy = Math.max(0, bbox.y_min) * image.height;
      const sw = Math.min(1, bbox.x_max) * image.width - sx;
      const sh = Math.min(1, bbox.y_max) * image.height - sy;
      if (!(sw > 0) || !(sh > 0)) { reject(new Error("Invalid crop region.")); return; }
      let w = sw, h = sh;
      if (w > h && w > maxDim) { h = h * maxDim / w; w = maxDim; }
      else if (h > maxDim) { w = w * maxDim / h; h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => reject(new Error("Couldn't read the source image for cropping."));
    image.src = dataUrl;
  });
}
