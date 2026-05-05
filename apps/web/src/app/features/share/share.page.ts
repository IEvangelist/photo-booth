import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    afterRenderEffect,
    computed,
    inject,
    viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import QRCode from 'qrcode';

import { CaptureState } from '../../core/api/booth-api.types';
import { IconComponent } from '../../core/icons/icon.component';
import { StatusService } from '../../core/signalr/status.service';
import { BoothStore } from '../../core/state/booth.store';

interface TimelineStep {
    state: CaptureState;
    label: string;
}

const TIMELINE: TimelineStep[] = [
    { state: 'queued', label: 'Received' },
    { state: 'stitching', label: 'Stitching GIF' },
    { state: 'uploaded', label: 'Uploaded' },
    { state: 'sending', label: 'Texting you' },
    { state: 'sent', label: 'Sent!' }
];

const ORDER: Record<string, number> = {
    queued: 0,
    stitching: 1,
    uploaded: 2,
    sending: 3,
    sent: 4,
    sms_failed: 4,
    stitch_failed: 4
};

@Component({
    selector: 'pb-share',
    standalone: true,
    imports: [IconComponent],
    template: `
        <section class="kiosk-shell share">
            <h1 class="kiosk-title small">{{ headline() }}</h1>
            <p class="kiosk-subtitle">{{ subline() }}</p>

            <ol class="timeline">
                @for (step of timeline; track step.state) {
                    <li
                        [class.active]="orderOf(currentState()) >= orderOf(step.state)"
                        [class.failed]="isFailed() && step.state === lastReachedStep()"
                    >
                        @if (orderOf(currentState()) >= orderOf(step.state)) {
                            <pb-icon name="check-circle" [size]="14" />
                        } @else {
                            <span class="dot"></span>
                        }
                        <span>{{ step.label }}</span>
                    </li>
                }
            </ol>

            @if (gifUrl(); as gif) {
                <div class="result">
                    <img class="gif-preview" [src]="gif" alt="your photo booth GIF" />
                    @if (qrTarget(); as target) {
                        <div class="qr-card">
                            <canvas #qrCanvas width="180" height="180"></canvas>
                            <p class="qr-label">
                                <pb-icon name="qr" [size]="14" />
                                <span>Scan to open</span>
                            </p>
                            <a class="share-link" [href]="target" target="_blank" rel="noopener">{{ target }}</a>
                        </div>
                    }
                    @if (smsFailed()) {
                        <p class="hint warn">Text didn't go through. Scan the QR code instead.</p>
                    }
                </div>
            }

            @if (errorText()) {
                <p class="banner-error">{{ errorText() }}</p>
            }

            <button type="button" class="cta-pill" (click)="done()" [disabled]="!canFinish()">
                @if (canFinish()) {
                    <pb-icon name="check-circle" [size]="22" />
                    <span>Done</span>
                } @else {
                    <span>Working…</span>
                }
            </button>
        </section>
    `,
    styles: [`
        .share { gap: 1.25rem; }
        .small { font-size: clamp(1.6rem, 4vw, 3rem); }
        .timeline {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
            justify-content: center;
        }
        .timeline li {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.4rem 0.85rem;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.04);
            color: #6b7388;
            font-weight: 500;
            transition: color 0.2s ease, background 0.2s ease;
        }
        .timeline li.active {
            color: #06d6a0;
            background: rgba(6, 214, 160, 0.12);
        }
        .timeline li.failed {
            color: #ef476f;
            background: rgba(239, 71, 111, 0.18);
        }
        .dot {
            width: 0.5rem;
            height: 0.5rem;
            background: currentColor;
            border-radius: 50%;
            display: inline-block;
        }
        .result {
            display: flex;
            gap: 1.5rem;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
        }
        .gif-preview {
            width: clamp(14rem, 28vw, 22rem);
            aspect-ratio: 4 / 3;
            object-fit: cover;
            border-radius: 1rem;
            box-shadow: 0 30px 60px -20px rgba(0,0,0,0.7);
        }
        .qr-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem 1.25rem;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 1.25rem;
            max-width: 18rem;
        }
        .qr-card canvas {
            background: white;
            border-radius: 0.5rem;
            padding: 0.4rem;
        }
        .qr-label {
            margin: 0;
            color: #b6becf;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
        .share-link {
            font-family: monospace;
            font-size: 0.75rem;
            color: #b6becf;
            word-break: break-all;
            text-align: center;
            text-decoration: underline;
            line-height: 1.2;
        }
        .hint {
            margin: 0;
            color: #6b7388;
            flex-basis: 100%;
            text-align: center;
        }
        .hint.warn { color: #ffd166; }
        .cta-pill { display: inline-flex; align-items: center; gap: 0.5rem; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharePage implements OnInit, OnDestroy {
    private readonly store = inject(BoothStore);
    private readonly status = inject(StatusService);
    private readonly router = inject(Router);

    private readonly qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

    protected readonly timeline = TIMELINE;

    protected readonly currentState = computed<CaptureState>(() => {
        const s = this.status.latest()?.state ?? this.store.status()?.state;
        return s ?? 'queued';
    });

    // Raw GIF blob URL — what we render inline as the preview image.
    protected readonly gifUrl = computed<string | null>(
        () => this.status.latest()?.shareUrl ?? this.store.status()?.shareUrl ?? null
    );

    // Kiosk-hosted landing page URL — what we encode in the QR and surface as
    // the canonical share link. Falls back to the raw GIF URL when the AppHost
    // hasn't been configured with a public booth URL.
    protected readonly qrTarget = computed<string | null>(
        () => this.status.latest()?.landingUrl
              ?? this.store.status()?.landingUrl
              ?? this.gifUrl()
    );

    protected readonly errorText = computed<string | null>(() => {
        if (this.currentState() === 'stitch_failed') {
            return 'We could not stitch your photos. Try again from the start.';
        }
        return this.status.latest()?.error ?? this.store.errorMessage();
    });

    protected readonly isFailed = computed(() =>
        this.currentState() === 'stitch_failed' || this.currentState() === 'sms_failed'
    );

    protected readonly smsFailed = computed(() => this.currentState() === 'sms_failed');

    protected readonly lastReachedStep = computed<CaptureState>(() => {
        const order = ORDER[this.currentState()] ?? 0;
        const reached = TIMELINE.find(s => ORDER[s.state] === order)?.state;
        return reached ?? 'queued';
    });

    protected readonly canFinish = computed(() => {
        const state = this.currentState();
        return state === 'sent' || state === 'sms_failed' || state === 'stitch_failed';
    });

    protected readonly headline = computed(() => {
        switch (this.currentState()) {
            case 'sent': return 'Look at your phone!';
            case 'sms_failed': return 'Almost there';
            case 'stitch_failed': return 'Something went sideways';
            default: return 'Cooking your GIF…';
        }
    });

    protected readonly subline = computed(() => {
        switch (this.currentState()) {
            case 'queued': return 'Your capture is in line.';
            case 'stitching': return 'Stitching frames into an animated GIF.';
            case 'uploaded': return 'GIF ready. Sending you the link.';
            case 'sending': return 'Texting your phone now.';
            case 'sent': return 'Tap done to start over.';
            case 'sms_failed': return 'We made the GIF, but couldn\'t text it. Use the QR code.';
            case 'stitch_failed': return 'Tap done to try again.';
            default: return '';
        }
    });

    constructor() {
        afterRenderEffect(() => {
            const url = this.qrTarget();
            const canvas = this.qrCanvas()?.nativeElement;
            if (url && canvas) {
                void QRCode.toCanvas(canvas, url, { width: 180, margin: 1 });
            }
        });
    }

    async ngOnInit(): Promise<void> {
        const captureId = this.store.captureId();
        if (!captureId) {
            void this.router.navigate(['/']);
            return;
        }
        try {
            await this.status.join(captureId);
        } catch {
            // status updates fall back to the snapshot we may already have
        }
    }

    async ngOnDestroy(): Promise<void> {
        await this.status.disconnect();
    }

    done(): void {
        if (!this.canFinish()) return;
        void this.router.navigate(['/']);
    }

    protected orderOf(state: CaptureState): number {
        return ORDER[state] ?? 0;
    }
}
