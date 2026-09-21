import { useEffect, useCallback } from 'react';

export interface UseImagePasteOptions {
  onFilesPasted: (files: File[]) => void;
  enabled?: boolean;
}

/**
 * Helper to extract image files from a ClipboardEvent.
 * Returns an array of File objects if images are found in the clipboard.
 */
export function extractImagesFromClipboard(e: React.ClipboardEvent | ClipboardEvent): File[] {
  const imageFiles: File[] = [];
  const clipboardData = e.clipboardData;
  if (!clipboardData) return imageFiles;

  const items = clipboardData.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          let ext = 'png';
          if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') ext = 'jpg';
          else if (blob.type === 'image/webp') ext = 'webp';
          else if (blob.type === 'image/gif') ext = 'gif';
          else if (blob.type.includes('/')) ext = blob.type.split('/')[1] || 'png';

          const originalName = (blob as File).name;
          const fileName = originalName && originalName !== 'image.png' && !originalName.startsWith('pasted_image_')
            ? originalName
            : `pasted_image_${Date.now()}_${i + 1}.${ext}`;

          const file = new File([blob], fileName, {
            type: blob.type || 'image/png',
            lastModified: Date.now(),
          });
          imageFiles.push(file);
        }
      }
    }
  }

  if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file.type && file.type.startsWith('image/')) {
        imageFiles.push(file);
      }
    }
  }

  return imageFiles;
}

/**
 * Custom React hook to listen for image paste events.
 */
export function useImagePaste({ onFilesPasted, enabled = true }: UseImagePasteOptions) {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;

      const files = extractImagesFromClipboard(e);
      if (files.length > 0) {
        e.preventDefault();
        onFilesPasted(files);
      }
    },
    [enabled, onFilesPasted]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handlePaste]);
}
