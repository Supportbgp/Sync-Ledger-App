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

// Vision-model bounding boxes for one pocket on a binder page are hit or
// miss — in practice the box tends to hug the card too tightly, and the
// edge it most often clips is the top (the bottom of a plastic pocket is
// usually a sharp, unambiguous line; the top blends into the page/pocket
// above it). Rather than trust the box as exactly right, pad it outward
// before cropping — generously on top, lightly everywhere else — so a
// slightly-short box still captures the whole card. Fractions are relative
// to the box's own width/height, not the full page, so padding scales with
// how big the detected card actually is. Clamped back to the source
// image's own [0,1] bounds.
const DEFAULT_CROP_PADDING = { top: 0.10, bottom: 0.02, left: 0.03, right: 0.03 };

// Real-world testing found the bottom row of a binder page consistently
// worse-clipped at the top than cards higher up the same photo — cards
// nearer the bottom of the frame are typically more foreshortened (closer
// to the camera / a steeper viewing angle when a page is photographed flat
// on a table or held up), which makes the model's already-weaker top-edge
// estimate for those specific cards even less reliable. Scales top padding
// up as a card's own bbox sits further down the frame — a card near the top
// of the photo gets close to the old flat 10%, one near the very bottom gets
// close to 18%. Bottom/left/right stay flat; only top was ever reported
// as the actual problem.
function adaptiveTopPadding(bbox) {
  return 0.08 + 0.10 * Math.min(1, Math.max(0, bbox.y_max));
}

// Crops one rectangular region out of a full data-URL image, given a
// bounding box as fractions (0.0-1.0) of the source image's width/height —
// the shape the binder scanner's vision model reports per detected card
// (see scan-binder-page's DETECT_CARDS_TOOL). This is how a single
// binder-page photo becomes each card's own "real photo" reference with no
// second upload. Output is capped to maxDim same as resizeImageFile, since
// a crop out of a full-page photo is still a large image.
export function cropImageRegion(dataUrl, bbox, maxDim = 500, quality = 0.82, padding = null) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const rawW = bbox.x_max - bbox.x_min;
      const rawH = bbox.y_max - bbox.y_min;
      if (!(rawW > 0) || !(rawH > 0)) { reject(new Error("Invalid crop region.")); return; }
      // No explicit override — use the flat left/right/bottom defaults, but
      // scale top by this card's own position in the page (see
      // adaptiveTopPadding above).
      const top = padding ? padding.top : adaptiveTopPadding(bbox);
      const bottom = padding ? padding.bottom : DEFAULT_CROP_PADDING.bottom;
      const left = padding ? padding.left : DEFAULT_CROP_PADDING.left;
      const right = padding ? padding.right : DEFAULT_CROP_PADDING.right;
      const x_min = Math.max(0, bbox.x_min - rawW * left);
      const x_max = Math.min(1, bbox.x_max + rawW * right);
      const y_min = Math.max(0, bbox.y_min - rawH * top);
      const y_max = Math.min(1, bbox.y_max + rawH * bottom);
      const sx = x_min * image.width;
      const sy = y_min * image.height;
      const sw = (x_max - x_min) * image.width;
      const sh = (y_max - y_min) * image.height;
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
