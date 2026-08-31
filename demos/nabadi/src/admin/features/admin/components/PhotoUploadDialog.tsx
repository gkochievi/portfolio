import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper, { type Area } from 'react-easy-crop';
import { Camera, RotateCcw, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Aspect ratio width / height. Default 4/5 to match the landing card. */
  aspect?: number;
  /** Max output edge in pixels. */
  maxOutputSize?: number;
  /** Called with the cropped JPEG Blob. */
  onConfirm: (blob: Blob) => Promise<void> | void;
  uploading?: boolean;
  error?: unknown;
}

/**
 * Reads a File into a data URL so the cropper can load it.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

/**
 * Decodes a data URL into an HTMLImageElement (so we can draw it on a canvas).
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = src;
  });
}

/**
 * Render the user-selected crop area to a canvas, capped at maxOutputSize on
 * the long edge. Returns a JPEG Blob (smaller, no transparency needed for photos).
 */
async function cropToBlob(
  imageSrc: string,
  cropPx: Area,
  rotation: number,
  maxOutputSize: number,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scale = Math.min(1, maxOutputSize / Math.max(cropPx.width, cropPx.height));
  canvas.width = Math.round(cropPx.width * scale);
  canvas.height = Math.round(cropPx.height * scale);

  if (rotation) {
    // Draw the rotated source into a temporary canvas first.
    const rotated = document.createElement('canvas');
    const rotCtx = rotated.getContext('2d');
    if (!rotCtx) throw new Error('Could not get canvas context');
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    rotated.width = image.width * cos + image.height * sin;
    rotated.height = image.width * sin + image.height * cos;
    rotCtx.translate(rotated.width / 2, rotated.height / 2);
    rotCtx.rotate(rad);
    rotCtx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.drawImage(
      rotated,
      cropPx.x,
      cropPx.y,
      cropPx.width,
      cropPx.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  } else {
    ctx.drawImage(
      image,
      cropPx.x,
      cropPx.y,
      cropPx.width,
      cropPx.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.9,
    );
  });
}

export function PhotoUploadDialog({
  open,
  onClose,
  aspect = 4 / 5,
  maxOutputSize = 1200,
  onConfirm,
  uploading,
  error,
}: Props) {
  const { t } = useTranslation('admin');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPx, setCroppedAreaPx] = useState<Area | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on close so opening again starts fresh — render-time, not useEffect.
  if (wasOpen && !open) {
    setWasOpen(false);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPx(null);
  } else if (!wasOpen && open) {
    setWasOpen(true);
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const url = await fileToDataUrl(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPx(areaPx);
  }, []);

  const onConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPx) return;
    const blob = await cropToBlob(imageSrc, croppedAreaPx, rotation, maxOutputSize);
    await onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('barbers_page.photo_upload_title')}</DialogTitle>

        {!imageSrc ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 border border-dashed border-line rounded-2xl bg-bg/40">
            <Camera className="h-10 w-10 text-ink-muted" />
            <p className="text-sm text-ink-muted text-center max-w-md">
              {t('barbers_page.photo_pick_hint')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-pill"
            >
              <Upload className="h-4 w-4" />
              {t('barbers_page.photo_pick')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative w-full bg-ink rounded-2xl overflow-hidden h-[440px] max-h-[50vh]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                showGrid={true}
                objectFit="cover"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <ZoomOut className="h-4 w-4 text-ink-muted" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-accent"
                  aria-label={t('barbers_page.photo_zoom')}
                />
                <ZoomIn className="h-4 w-4 text-ink-muted" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-pill"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('barbers_page.photo_rotate')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setImageSrc(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-pill"
              >
                {t('barbers_page.photo_pick_other')}
              </Button>
            </div>
          </div>
        )}

        <ErrorMessage error={error} />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-pill">
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={onConfirmCrop}
            disabled={!imageSrc || !croppedAreaPx}
            loading={uploading}
            className="rounded-pill"
          >
            {t('barbers_page.photo_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
