import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Camera, ImageIcon, Loader2, Trash2, User, X } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { blobToJpegFile, getCroppedImageBlob } from '../lib/cropImage';
import { validateAvatarSourceFile } from '../lib/profileAvatarUpload';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { cn } from './ui/utils';

interface ProfileAvatarEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarUrl?: string;
  avatarAlt?: string;
  hasAvatar: boolean;
  busy: boolean;
  onCroppedFile: (file: File) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}

export function ProfileAvatarEditor({
  open,
  onOpenChange,
  avatarUrl = '',
  avatarAlt = '',
  hasAvatar,
  busy,
  onCroppedFile,
  onRemove,
}: ProfileAvatarEditorProps) {
  const { profileT } = useLocale();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pickingRef = useRef(false);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  const resetCropState = useCallback(() => {
    setImageSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropping(false);
  }, []);

  const cropOpen = Boolean(imageSrc);

  useEffect(() => {
    if (!cropOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cropOpen]);

  useEffect(() => {
    const onFocus = () => {
      window.setTimeout(() => {
        pickingRef.current = false;
      }, 400);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleSheetOpenChange = (next: boolean) => {
    if (busy || cropping || imageSrc || pickingRef.current) return;
    onOpenChange(next);
  };

  const openSource = (kind: 'gallery' | 'camera') => {
    if (busy) return;
    pickingRef.current = true;
    if (kind === 'gallery') galleryInputRef.current?.click();
    else cameraInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    pickingRef.current = false;
    if (!file || busy) return;

    const invalid = validateAvatarSourceFile(file);
    if (invalid === 'INVALID_TYPE') {
      toast.error(profileT.avatarInvalidType);
      return;
    }
    if (invalid === 'TOO_LARGE') {
      toast.error(profileT.avatarTooLarge);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels || cropping || busy) return;
    setCropping(true);
    let blob: Blob;
    try {
      blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
    } catch {
      toast.error(profileT.avatarCropFailed);
      setCropping(false);
      return;
    }

    try {
      const file = blobToJpegFile(blob, `avatar-${Date.now()}.jpg`);
      await onCroppedFile(file);
      resetCropState();
      onOpenChange(false);
    } catch {
      // Upload errors are toasted by the parent.
    } finally {
      setCropping(false);
    }
  };

  const handleRemove = async () => {
    if (!hasAvatar || busy) return;
    onOpenChange(false);
    await onRemove();
  };

  const actionBtnClass =
    'flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[15px] font-normal text-white transition hover:bg-white/5 active:bg-white/10 disabled:opacity-50';

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        className="hidden"
        onChange={handleFileChange}
        onClick={() => {
          pickingRef.current = true;
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
        onClick={() => {
          pickingRef.current = true;
        }}
      />

      <Sheet open={open && !cropOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'gap-0 border-0 bg-[#1c1c1e] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-white',
            'rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] [&>button]:hidden',
          )}
        >
          <SheetHeader className="mb-4 space-y-0 p-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0 border border-white/15 bg-[#3a3a3c]">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={avatarAlt || profileT.avatarPickerTitle} /> : null}
                <AvatarFallback className="bg-[#3a3a3c] text-white/70">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <SheetTitle className="flex-1 text-left text-[17px] font-semibold tracking-tight text-white">
                {profileT.avatarPickerTitle}
              </SheetTitle>
              <button
                type="button"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3a3a3c] text-white/90 transition hover:bg-[#48484a] disabled:opacity-50"
                aria-label={profileT.avatarCancel}
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <SheetDescription className="sr-only">{profileT.avatarPickerHint}</SheetDescription>
          </SheetHeader>

          <div className="overflow-hidden rounded-2xl bg-[#2c2c2e]">
            <button type="button" disabled={busy} onClick={() => openSource('camera')} className={actionBtnClass}>
              <Camera className="h-[22px] w-[22px] shrink-0 text-white" strokeWidth={1.75} />
              {profileT.avatarTakePhoto}
            </button>
            <div className="ml-[50px] h-px bg-white/10" />
            <button type="button" disabled={busy} onClick={() => openSource('gallery')} className={actionBtnClass}>
              <ImageIcon className="h-[22px] w-[22px] shrink-0 text-white" strokeWidth={1.75} />
              {profileT.avatarChooseLibrary}
            </button>
            {hasAvatar ? (
              <>
                <div className="ml-[50px] h-px bg-white/10" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove()}
                  className={cn(actionBtnClass, 'text-[#ff453a]')}
                >
                  {busy ? (
                    <Loader2 className="h-[22px] w-[22px] shrink-0 animate-spin text-[#ff453a]" />
                  ) : (
                    <Trash2 className="h-[22px] w-[22px] shrink-0 text-[#ff453a]" strokeWidth={1.75} />
                  )}
                  {profileT.avatarRemove}
                </button>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {cropOpen && imageSrc
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-[#1c1c1e] text-white"
              role="dialog"
              aria-modal="true"
              aria-labelledby="avatar-crop-title"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <h2 id="avatar-crop-title" className="text-base font-semibold">
                    {profileT.avatarCropTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/60">{profileT.avatarCropHint}</p>
                </div>
                <button
                  type="button"
                  disabled={cropping || busy}
                  onClick={resetCropState}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3a3a3c] text-white/90 transition hover:bg-[#48484a] disabled:opacity-50"
                  aria-label={profileT.avatarCancel}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              <div className="relative min-h-0 flex-1 bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  objectFit="contain"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                  style={{
                    containerStyle: { position: 'absolute', inset: 0 },
                  }}
                />
              </div>

              <div className="space-y-3 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60" htmlFor="avatar-zoom">
                    {profileT.avatarZoom}
                  </label>
                  <Slider
                    id="avatar-zoom"
                    min={1}
                    max={3}
                    step={0.05}
                    value={[zoom]}
                    onValueChange={(value) => setZoom(value[0] ?? 1)}
                    disabled={cropping || busy}
                    trackClassName="bg-white/20 data-[orientation=horizontal]:h-1.5"
                    rangeClassName="bg-white"
                    thumbClassName="size-[18px] border-0 bg-white shadow-md"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={cropping || busy}
                    onClick={resetCropState}
                    className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    {profileT.avatarCancel}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-white text-black hover:bg-white/90"
                    disabled={cropping || busy || !croppedAreaPixels}
                    onClick={() => void handleConfirmCrop()}
                  >
                    {cropping || busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {profileT.avatarUploading}
                      </>
                    ) : (
                      profileT.avatarCropConfirm
                    )}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
