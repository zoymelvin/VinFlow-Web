export async function compressImageFile(
  file: File,
  opts: { max?: number; quality?: number; maxBytes?: number } = {}
): Promise<string> {
  const max = opts.max ?? 256;
  const quality = opts.quality ?? 0.8;
  const maxBytes = opts.maxBytes ?? 400_000;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Image file is too large (max 15MB).");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Image could not be decoded."));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > max) { h = Math.round((h * max) / w); w = max; }
        } else {
          if (h > max) { w = Math.round((w * max) / h); h = max; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported.")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const result = canvas.toDataURL("image/jpeg", quality);
        if (result.length > maxBytes * 1.35) {
          reject(new Error("Compressed image is still too large. Try a smaller photo."));
          return;
        }
        resolve(result);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
