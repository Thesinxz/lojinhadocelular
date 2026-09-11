/**
 * Compressor de Imagens no Cliente (Navegador)
 * Lojinha do Celular — Troca Fácil
 *
 * Redimensiona e comprime fotos pesadas tiradas por smartphones (ex: 5MB a 12MB)
 * diretamente no navegador usando HTML5 Canvas, reduzindo para ~100KB - 180KB
 * em formato WebP/JPEG com altíssima nitidez antes do envio.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
}

export interface CompressionResult {
  file: File;
  previewUrl: string;
  dataUrl?: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.78,
    mimeType = "image/webp",
  } = options;

  // Se o arquivo já for minúsculo (< 60KB), retorna direto
  if (file.size < 60 * 1024) {
    const previewUrl = URL.createObjectURL(file);
    let dataUrl: string | undefined;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {}
    return {
      file,
      previewUrl,
      dataUrl,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Mantém proporção limitando ao maxWidth / maxHeight
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback caso canvas 2D falhe
        const fallbackUrl = URL.createObjectURL(file);
        fileToDataUrl(file)
          .then((dataUrl) => {
            resolve({
              file,
              previewUrl: fallbackUrl,
              dataUrl,
              originalSize: file.size,
              compressedSize: file.size,
              savingsPercent: 0,
            });
          })
          .catch(() => {
            resolve({
              file,
              previewUrl: fallbackUrl,
              originalSize: file.size,
              compressedSize: file.size,
              savingsPercent: 0,
            });
          });
        return;
      }

      // Desenha com suavização bilinear de alta qualidade
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Tenta exportar para WebP, com fallback transparente para JPEG
      const chosenMime = mimeType;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback para JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob) {
                  const fallbackUrl = URL.createObjectURL(file);
                  fileToDataUrl(file)
                    .then((dataUrl) => {
                      resolve({
                        file,
                        previewUrl: fallbackUrl,
                        dataUrl,
                        originalSize: file.size,
                        compressedSize: file.size,
                        savingsPercent: 0,
                      });
                    })
                    .catch(() => {
                      resolve({
                        file,
                        previewUrl: fallbackUrl,
                        originalSize: file.size,
                        compressedSize: file.size,
                        savingsPercent: 0,
                      });
                    });
                  return;
                }
                finish(jpegBlob, "image/jpeg", ".jpg");
              },
              "image/jpeg",
              quality
            );
            return;
          }
          const ext = chosenMime === "image/webp" ? ".webp" : ".jpg";
          finish(blob, chosenMime, ext);
        },
        chosenMime,
        quality
      );

      function finish(blob: Blob, type: string, ext: string) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const compressedFile = new File([blob], `${baseName}${ext}`, {
          type,
          lastModified: Date.now(),
        });

        const previewUrl = URL.createObjectURL(compressedFile);
        let dataUrl: string | undefined;
        try {
          dataUrl = canvas.toDataURL(type, quality);
        } catch {}

        const originalSize = file.size;
        const compressedSize = compressedFile.size;
        const savingsPercent = Math.max(
          0,
          Math.round(((originalSize - compressedSize) / originalSize) * 100)
        );

        resolve({
          file: compressedFile,
          previewUrl,
          dataUrl,
          originalSize,
          compressedSize,
          savingsPercent,
        });
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
