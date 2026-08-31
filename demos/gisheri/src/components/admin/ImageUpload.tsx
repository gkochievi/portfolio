import { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { uploadImage } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  className?: string;
  /** Optional: pre-fill manual URL textbox if no upload yet. */
  allowManualUrl?: boolean;
}

const ImageUpload = ({ value, onChange, className, allowManualUrl = true }: ImageUploadProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [manualUrl, setManualUrl] = useState(value);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file);
      onChange(result.url);
      setManualUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.image.uploadFailed', { defaultValue: 'Upload failed' }));
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          'border-border hover:border-foreground/30',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          onChange={onInputChange}
          className="hidden"
        />
        {value ? (
          <div className="w-full">
            <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-md bg-muted">
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3 break-all">{value}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {uploading ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
            <p className="text-sm">
              {uploading
                ? t('admin.image.uploading', { defaultValue: 'Uploading…' })
                : t('admin.image.drag', { defaultValue: 'Drag image here or click to browse' })}
            </p>
            <p className="text-xs">{t('admin.image.dragHint', { defaultValue: 'JPG, PNG, WEBP, GIF · max 8MB' })}</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange('');
              setManualUrl('');
            }}
          >
            <X size={14} />
            {t('admin.image.remove', { defaultValue: 'Remove' })}
          </Button>
        )}
        {allowManualUrl && (
          <details className="ml-auto">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground inline-flex items-center gap-1">
              <ImageIcon size={12} />
              {t('admin.image.orPasteUrl', { defaultValue: 'Or paste URL' })}
            </summary>
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                placeholder="https://… or /media/…"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange(manualUrl)}
                disabled={!manualUrl || manualUrl === value}
              >
                {t('admin.image.use', { defaultValue: 'Use' })}
              </Button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
