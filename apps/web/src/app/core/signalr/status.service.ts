import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    HubConnection,
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel
} from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { CaptureStatusDto } from '../api/booth-api.types';

@Injectable({ providedIn: 'root' })
export class StatusService {
    private readonly destroyRef = inject(DestroyRef);
    private connection?: HubConnection;
    private currentCaptureId?: string;

    readonly latest = signal<CaptureStatusDto | null>(null);
    readonly connected = signal(false);

    constructor() {
        this.destroyRef.onDestroy(() => void this.disconnect());
    }

    async join(captureId: string): Promise<void> {
        if (this.currentCaptureId === captureId && this.connection?.state === HubConnectionState.Connected) {
            return;
        }

        await this.disconnect();
        this.latest.set(null);
        this.currentCaptureId = captureId;

        const connection = new HubConnectionBuilder()
            .withUrl(`${environment.apiBaseUrl}${environment.hubPath}`, { withCredentials: true })
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Information)
            .build();

        connection.on('status', (payload: CaptureStatusDto) => {
            if (payload.captureId === this.currentCaptureId) {
                this.latest.set(payload);
            }
        });

        connection.onreconnected(() => {
            this.connected.set(true);
            if (this.currentCaptureId) {
                void connection.invoke('JoinCapture', this.currentCaptureId);
            }
        });
        connection.onclose(() => this.connected.set(false));

        await connection.start();
        this.connection = connection;
        this.connected.set(true);

        await connection.invoke('JoinCapture', captureId);
    }

    async disconnect(): Promise<void> {
        const c = this.connection;
        this.connection = undefined;
        this.currentCaptureId = undefined;
        this.connected.set(false);
        if (c) {
            try {
                await c.stop();
            } catch {
                // best effort
            }
        }
    }
}
