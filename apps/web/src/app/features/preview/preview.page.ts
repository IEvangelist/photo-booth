import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnDestroy,
    OnInit,
    computed,
    effect,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BoothApiService } from '../../core/api/booth-api.service';
import { BoothStore } from '../../core/state/booth.store';

@Component({
    selector: 'pb-preview',
    template: `
        <section class="kiosk-shell preview">
            <h1 class="kiosk-title small">Looking good?</h1>
            @if (currentFrame(); as frame) {
                <div class="frame-wrapper">
                    <img class="frame" [src]="frame" alt="captured frame" />
                    <span class="badge">Preview</span>
                </div>
            } @else {
                <p class="kiosk-subtitle">No frames captured.</p>
            }
            @if (sending()) {
                <p class="kiosk-subtitle">Sending to the booth…</p>
            } @else if (error()) {
                <p class="banner-error">{{ error() }}</p>
            }

            <div class="actions">
                <button type="button" class="ghost" (click)="retry()" [disabled]="sending()">Retake</button>
                <button type="button" class="cta-pill" (click)="send()" [disabled]="sending() || !hasFrames()">
                    {{ sending() ? 'Sending…' : 'Send it!' }}
                </button>
            </div>
        </section>
    `,
    styles: [`
        .preview { gap: 1.5rem; }
        .small { font-size: clamp(1.6rem, 4vw, 3rem); }
        .frame-wrapper {
            position: relative;
            width: clamp(20rem, 50vw, 36rem);
            aspect-ratio: 4 / 3;
            border-radius: 1.5rem;
            overflow: hidden;
            box-shadow: 0 30px 60px -20px rgba(0,0,0,0.65);
            background: #000;
        }
        .frame {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .badge {
            position: absolute;
            top: 0.75rem;
            left: 0.75rem;
            padding: 0.25rem 0.75rem;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 9999px;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #f5f7fa;
        }
        .actions { display: flex; gap: 1rem; }
        .ghost {
            padding: 1rem 2rem;
            border-radius: 9999px;
            color: #b6becf;
            font-weight: 600;
        }
        .ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
        .ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreviewPage implements OnInit, OnDestroy {
    private readonly store = inject(BoothStore);
    private readonly api = inject(BoothApiService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly sending = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly frameIndex = signal<number>(0);
    protected readonly hasFrames = computed(() => this.store.frames().length > 0);
    protected readonly currentFrame = computed(() => this.store.frames()[this.frameIndex()] ?? null);

    private cycleHandle?: ReturnType<typeof setInterval>;

    ngOnInit(): void {
        if (!this.hasFrames()) {
            void this.router.navigate(['/']);
            return;
        }
        const delay = this.store.options()?.frameDelay ?? 333;
        this.cycleHandle = setInterval(() => {
            const total = this.store.frames().length;
            this.frameIndex.update(i => (i + 1) % total);
        }, delay);
    }

    ngOnDestroy(): void {
        if (this.cycleHandle) clearInterval(this.cycleHandle);
    }

    retry(): void {
        if (this.sending()) return;
        this.store.setFrames([]);
        void this.router.navigate(['/capture']);
    }

    send(): void {
        if (this.sending() || !this.hasFrames()) return;
        const phone = this.store.phoneNumber();
        const frames = this.store.frames();
        if (!phone || !frames.length) {
            this.error.set('Missing phone or frames.');
            return;
        }

        this.sending.set(true);
        this.error.set(null);
        this.api
            .createCapture({ phone, frames })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: response => {
                    this.store.setCapture(response.captureId);
                    this.sending.set(false);
                    void this.router.navigate(['/share']);
                },
                error: err => {
                    this.sending.set(false);
                    const message = err?.error?.error ?? 'The booth could not accept your photos. Try again.';
                    this.error.set(message);
                }
            });
    }
}
