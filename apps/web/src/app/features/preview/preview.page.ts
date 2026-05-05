import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    computed,
    inject,
    signal
} from '@angular/core';
import { Router } from '@angular/router';

import { IconComponent } from '../../core/icons/icon.component';
import { BoothStore } from '../../core/state/booth.store';

@Component({
    selector: 'pb-preview',
    standalone: true,
    imports: [IconComponent],
    template: `
        <section class="kiosk-shell preview">
            <h1 class="kiosk-title small">Looking good?</h1>
            @if (currentFrame(); as frame) {
                <div class="frame-wrapper">
                    <img class="frame" [src]="frame" alt="captured frame" />
                    <span class="badge">
                        <pb-icon name="film" [size]="14" />
                        <span>Preview</span>
                    </span>
                </div>
            } @else {
                <p class="kiosk-subtitle">No frames captured.</p>
            }

            <div class="actions">
                <button type="button" class="ghost" (click)="retry()">
                    <pb-icon name="refresh" [size]="20" />
                    <span>Retake</span>
                </button>
                <button type="button" class="cta-pill" (click)="continue()" [disabled]="!hasFrames()">
                    <span>Looks good — text it</span>
                    <pb-icon name="arrow-right" [size]="22" />
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
            padding: 0.3rem 0.75rem;
            background: rgba(0, 0, 0, 0.55);
            border-radius: 9999px;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #f5f7fa;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
        .actions { display: flex; gap: 1rem; align-items: center; }
        .actions .cta-pill,
        .actions .ghost {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
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
    private readonly router = inject(Router);

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
        this.store.setFrames([]);
        void this.router.navigate(['/capture']);
    }

    continue(): void {
        if (!this.hasFrames()) return;
        // Phone collection happens AFTER the photos are taken so the customer
        // has already approved their shots before being asked for any PII.
        void this.router.navigate(['/phone']);
    }
}
