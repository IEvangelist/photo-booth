import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    inject,
    signal,
    viewChild
} from '@angular/core';
import { Router } from '@angular/router';

import { BoothStore } from '../../core/state/booth.store';

type Phase = 'priming' | 'countdown' | 'capturing' | 'done' | 'error';

@Component({
    selector: 'pb-camera',
    template: `
        <section class="stage">
            <video #videoEl class="feed" autoplay playsinline muted></video>
            <canvas #canvasEl hidden></canvas>

            <div class="overlay">
                @switch (phase()) {
                    @case ('priming') {
                        <p class="msg">Get ready…</p>
                    }
                    @case ('countdown') {
                        <div class="countdown">{{ countdownLabel() }}</div>
                    }
                    @case ('capturing') {
                        <div class="capturing">
                            <span>Snap!</span>
                            <small>{{ snapped() }} / {{ totalFrames() }}</small>
                        </div>
                    }
                    @case ('error') {
                        <div class="msg">
                            <p class="banner-error">{{ errorMessage() ?? 'Camera unavailable.' }}</p>
                            <button type="button" class="cta-pill" (click)="goHome()">Back to start</button>
                        </div>
                    }
                }
            </div>

            <div class="flash" [class.active]="flashing()"></div>
        </section>
    `,
    styles: [`
        :host { display: block; height: 100%; width: 100%; }
        .stage {
            position: relative;
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
        }
        .feed {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
        }
        .overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #fff;
            text-shadow: 0 4px 20px rgba(0,0,0,0.6);
            gap: 1.5rem;
            pointer-events: none;
        }
        .overlay > * { pointer-events: auto; }
        .countdown {
            font-size: clamp(8rem, 25vw, 18rem);
            font-weight: 900;
            line-height: 1;
            color: #ffd166;
            animation: pop 1s ease-out;
        }
        .capturing span {
            display: block;
            font-size: clamp(4rem, 12vw, 8rem);
            font-weight: 800;
            color: #ef476f;
        }
        .capturing small {
            font-size: 1.5rem;
            color: #f5f7fa;
            opacity: 0.9;
        }
        .msg {
            font-size: clamp(1.5rem, 4vw, 2.4rem);
            font-weight: 600;
        }
        .flash {
            position: absolute;
            inset: 0;
            background: white;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.12s ease;
        }
        .flash.active { opacity: 0.85; }
        @keyframes pop {
            0% { transform: scale(1.6); opacity: 0; }
            30% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.6); opacity: 0.9; }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraPage implements AfterViewInit, OnDestroy {
    private readonly store = inject(BoothStore);
    private readonly router = inject(Router);

    private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
    private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasEl');

    protected readonly phase = signal<Phase>('priming');
    protected readonly countdownLabel = signal<string>('');
    protected readonly snapped = signal<number>(0);
    protected readonly flashing = signal<boolean>(false);
    protected readonly errorMessage = signal<string | null>(null);

    protected readonly totalFrames = signal<number>(this.store.options()?.photosToTake ?? 3);

    private mediaStream: MediaStream | null = null;
    private aborted = false;
    private timeoutHandles: ReturnType<typeof setTimeout>[] = [];

    async ngAfterViewInit(): Promise<void> {
        const opts = this.store.options();
        if (!opts) {
            this.failWith('Missing booth options.');
            return;
        }
        this.totalFrames.set(opts.photosToTake);

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: opts.imageWidth },
                    height: { ideal: opts.imageHeight },
                    facingMode: 'user'
                },
                audio: false
            });
        } catch (err) {
            this.failWith('We need camera permission to take photos.');
            return;
        }

        const video = this.videoRef().nativeElement;
        video.srcObject = this.mediaStream;
        await this.waitForVideoMetadata(video);

        await this.runCapture(opts);
        if (this.aborted) return;

        this.phase.set('done');
        void this.router.navigate(['/preview']);
    }

    ngOnDestroy(): void {
        this.aborted = true;
        for (const h of this.timeoutHandles) clearTimeout(h);
        this.timeoutHandles = [];
        if (this.mediaStream) {
            for (const track of this.mediaStream.getTracks()) track.stop();
            this.mediaStream = null;
        }
    }

    protected goHome(): void {
        this.store.reset();
        void this.router.navigate(['/']);
    }

    private failWith(message: string): void {
        this.errorMessage.set(message);
        this.phase.set('error');
        this.store.setError(message);
    }

    private waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
        if (video.readyState >= 2) return Promise.resolve();
        return new Promise<void>(resolve => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });
    }

    private async runCountdown(start: number, intervalMs: number): Promise<void> {
        this.phase.set('countdown');
        for (let i = start; i >= 1; i--) {
            if (this.aborted) return;
            this.countdownLabel.set(String(i));
            await this.delay(intervalMs);
        }
        this.countdownLabel.set('Smile!');
        await this.delay(Math.min(intervalMs, 600));
    }

    private async runCapture(opts: { photosToTake: number; photoCountDownDefault: number; intervalBetweenCountDown: number; imageWidth: number; imageHeight: number }): Promise<void> {
        const canvas = this.canvasRef().nativeElement;
        canvas.width = opts.imageWidth;
        canvas.height = opts.imageHeight;
        const ctx = canvas.getContext('2d');
        const video = this.videoRef().nativeElement;
        if (!ctx) {
            this.failWith('Could not initialize canvas.');
            return;
        }

        const frames: string[] = [];
        for (let i = 0; i < opts.photosToTake; i++) {
            // Each shot gets its own countdown so the subject can pose between snaps.
            await this.runCountdown(opts.photoCountDownDefault, opts.intervalBetweenCountDown);
            if (this.aborted) return;

            this.phase.set('capturing');
            // Mirror to match the preview (we flipped the video element with CSS only).
            ctx.save();
            ctx.translate(opts.imageWidth, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, opts.imageWidth, opts.imageHeight);
            ctx.restore();

            this.flash();
            frames.push(canvas.toDataURL('image/png'));
            this.snapped.set(i + 1);

            if (i < opts.photosToTake - 1) {
                // Brief pause so "Snap!" is visible before the next countdown starts.
                await this.delay(opts.intervalBetweenCountDown);
                if (this.aborted) return;
            }
        }

        this.store.setFrames(frames);
    }

    private flash(): void {
        this.flashing.set(true);
        const handle = setTimeout(() => this.flashing.set(false), 130);
        this.timeoutHandles.push(handle);
    }

    private delay(ms: number): Promise<void> {
        return new Promise<void>(resolve => {
            const handle = setTimeout(() => resolve(), ms);
            this.timeoutHandles.push(handle);
        });
    }
}
