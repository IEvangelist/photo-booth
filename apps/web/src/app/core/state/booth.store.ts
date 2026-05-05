import { Injectable, computed, signal } from '@angular/core';

import { BoothOptionsDto, CaptureStatusDto } from '../api/booth-api.types';

export type BoothPhase =
    | 'idle'
    | 'phoneEntry'
    | 'countdown'
    | 'capturing'
    | 'previewing'
    | 'sharing'
    | 'finished'
    | 'error';

@Injectable({ providedIn: 'root' })
export class BoothStore {
    readonly phase = signal<BoothPhase>('idle');
    readonly options = signal<BoothOptionsDto | null>(null);
    readonly phoneNumber = signal<string>('');
    readonly frames = signal<string[]>([]);
    readonly captureId = signal<string | null>(null);
    readonly status = signal<CaptureStatusDto | null>(null);
    readonly errorMessage = signal<string | null>(null);

    readonly canStartCapture = computed(() => {
        const opts = this.options();
        const phone = this.phoneNumber();
        return !!opts && /^\+\d{8,15}$/.test(phone);
    });

    readonly shareUrl = computed(() => this.status()?.shareUrl ?? null);

    setOptions(value: BoothOptionsDto): void {
        this.options.set(value);
    }

    setPhase(value: BoothPhase): void {
        this.phase.set(value);
    }

    setPhone(value: string): void {
        this.phoneNumber.set(value);
    }

    setFrames(value: string[]): void {
        this.frames.set(value);
    }

    setCapture(id: string): void {
        this.captureId.set(id);
    }

    setStatus(value: CaptureStatusDto | null): void {
        this.status.set(value);
    }

    setError(message: string | null): void {
        this.errorMessage.set(message);
        if (message) {
            this.phase.set('error');
        }
    }

    reset(): void {
        this.phase.set('idle');
        this.phoneNumber.set('');
        this.frames.set([]);
        this.captureId.set(null);
        this.status.set(null);
        this.errorMessage.set(null);
    }
}
