export interface BoothOptionsDto {
    photosToTake: number;
    photoCountDownDefault: number;
    intervalBetweenCountDown: number;
    frameDelay: number;
    imageWidth: number;
    imageHeight: number;
}

export interface CreateCaptureRequest {
    phone: string;
    frames: string[];
}

export interface CreateCaptureResponse {
    captureId: string;
}

export type CaptureState =
    | 'queued'
    | 'stitching'
    | 'uploaded'
    | 'sending'
    | 'sent'
    | 'sms_failed'
    | 'stitch_failed';

export interface CaptureStatusDto {
    captureId: string;
    state: CaptureState;
    shareUrl?: string | null;
    thumbnailUrl?: string | null;
    landingUrl?: string | null;
    error?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface GalleryItemDto {
    captureId: string;
    shareUrl: string;
    thumbnailUrl?: string | null;
    landingUrl: string;
    createdAt: string;
}

export interface GalleryResponseDto {
    items: GalleryItemDto[];
}
