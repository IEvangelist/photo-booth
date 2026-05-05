import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    computed,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { BoothApiService } from '../../core/api/booth-api.service';
import { CaptureStatusDto } from '../../core/api/booth-api.types';
import { IconComponent } from '../../core/icons/icon.component';

interface ShareTarget {
    id: string;
    label: string;
    icon: string;
    href: string;
    background: string;
    color?: string;
}

@Component({
    selector: 'pb-landing',
    standalone: true,
    imports: [CommonModule, IconComponent],
    template: `
        <main class="landing">
            <header class="landing-header">
                <p class="overline">Photo Booth</p>
                <h1 class="title">Your GIF is ready</h1>
            </header>

            @if (loading()) {
                <p class="kiosk-subtitle">Loading your moment…</p>
            } @else if (error()) {
                <p class="banner-error">{{ error() }}</p>
            } @else if (gifUrl(); as gif) {
                <figure class="gif-wrap">
                    <img class="gif" [src]="gif" alt="your photo booth animated GIF" />
                </figure>

                <section class="actions" aria-label="Share your GIF">
                    @if (canNativeShare()) {
                        <button type="button" class="btn primary" (click)="onNativeShare()">
                            <pb-icon name="share" [size]="22" />
                            <span>Share</span>
                        </button>
                    }

                    <button type="button" class="btn copy" (click)="onCopy()">
                        <pb-icon [name]="copied() ? 'check-circle' : 'copy'" [size]="22" />
                        <span>{{ copied() ? 'Copied!' : 'Copy link' }}</span>
                    </button>

                    <a class="btn download" [href]="gif" [download]="downloadName()" rel="noopener">
                        <pb-icon name="download" [size]="22" />
                        <span>Download GIF</span>
                    </a>
                </section>

                <section class="socials" aria-label="Share on social media">
                    @for (target of socialTargets(); track target.id) {
                        <a class="social"
                           [style.background]="target.background"
                           [style.color]="target.color ?? '#fff'"
                           [href]="target.href"
                           target="_blank"
                           rel="noopener noreferrer"
                           [attr.aria-label]="'Share on ' + target.label">
                            <pb-icon [name]="$any(target.icon)" [size]="20" />
                            <span>{{ target.label }}</span>
                        </a>
                    }
                </section>

                <p class="footer-hint">Captured {{ createdAt() | date: 'mediumDate' }} at the photo booth.</p>
            }
        </main>
    `,
    styles: [`
        :host {
            display: block;
            min-height: 100vh;
            overflow-y: auto;
        }
        .landing {
            min-height: 100vh;
            box-sizing: border-box;
            padding: clamp(1.5rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem) 4rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 1.25rem;
            background:
                radial-gradient(circle at 20% 0%, rgba(239, 71, 111, 0.18), transparent 55%),
                radial-gradient(circle at 80% 10%, rgba(255, 209, 102, 0.15), transparent 50%),
                radial-gradient(circle at 50% 100%, rgba(6, 214, 160, 0.15), transparent 55%),
                #0b0e16;
        }
        .landing-header { display: flex; flex-direction: column; gap: 0.5rem; }
        .overline {
            color: #b6becf;
            text-transform: uppercase;
            letter-spacing: 0.3em;
            font-size: 0.75rem;
            margin: 0;
        }
        .title {
            margin: 0;
            font-size: clamp(2rem, 7vw, 3rem);
            font-weight: 800;
            background: linear-gradient(120deg, #ffd166, #ef476f, #06d6a0);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .gif-wrap {
            margin: 0;
            width: 100%;
            max-width: 32rem;
        }
        .gif {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 1.25rem;
            box-shadow: 0 30px 70px -20px rgba(0,0,0,0.7);
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.6rem;
            width: 100%;
            max-width: 32rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.85rem 1.4rem;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 0.95rem;
            text-decoration: none;
            color: #f5f7fa;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            cursor: pointer;
            transition: transform 0.1s ease, background 0.15s ease;
        }
        .btn:hover { background: rgba(255, 255, 255, 0.12); }
        .btn:active { transform: scale(0.97); }
        .btn.primary {
            background: linear-gradient(120deg, #ef476f, #ffd166);
            color: #15101e;
            border-color: transparent;
        }
        .socials {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.55rem;
            width: 100%;
            max-width: 32rem;
            margin-top: 0.25rem;
        }
        .social {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.65rem 1rem;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.85rem;
            text-decoration: none;
            transition: transform 0.1s ease, filter 0.15s ease;
        }
        .social:hover { filter: brightness(1.1); }
        .social:active { transform: scale(0.97); }
        .footer-hint {
            color: #6b7388;
            font-size: 0.8rem;
            margin-top: 1rem;
        }
        .banner-error {
            background: rgba(239, 71, 111, 0.15);
            border: 1px solid rgba(239, 71, 111, 0.45);
            color: #ffb3c0;
            padding: 0.85rem 1.4rem;
            border-radius: 0.75rem;
            max-width: 36rem;
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPage implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly api = inject(BoothApiService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly loading = signal(true);
    protected readonly error = signal<string | null>(null);
    protected readonly status = signal<CaptureStatusDto | null>(null);
    protected readonly copied = signal(false);

    protected readonly gifUrl = computed(() => this.status()?.shareUrl ?? null);
    protected readonly landingUrl = computed(() => {
        if (typeof window === 'undefined') return '';
        return window.location.href;
    });
    protected readonly createdAt = computed(() => this.status()?.createdAt ?? null);
    protected readonly downloadName = computed(() => `photo-booth-${this.status()?.captureId ?? 'gif'}.gif`);

    protected readonly canNativeShare = computed(() => {
        if (typeof navigator === 'undefined') return false;
        // canShare(...) returns true when the platform can satisfy this share payload.
        // We always share the URL, never files, so the simple capability check is enough.
        return typeof navigator.share === 'function';
    });

    protected readonly socialTargets = computed<ShareTarget[]>(() => {
        const url = this.landingUrl();
        const text = 'Check out my photo booth GIF!';
        const encoded = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);
        return [
            {
                id: 'x',
                label: 'X / Twitter',
                icon: 'twitter',
                href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`,
                background: '#0b0e16',
                color: '#f5f7fa',
            },
            {
                id: 'facebook',
                label: 'Facebook',
                icon: 'facebook',
                href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
                background: '#1877f2',
            },
            {
                id: 'whatsapp',
                label: 'WhatsApp',
                icon: 'whatsapp',
                href: `https://wa.me/?text=${encodedText}%20${encoded}`,
                background: '#25d366',
                color: '#0b0e16',
            },
            {
                id: 'email',
                label: 'Email',
                icon: 'mail',
                href: `mailto:?subject=${encodeURIComponent('Photo booth GIF')}&body=${encodedText}%20${encoded}`,
                background: '#3b4252',
            },
        ];
    });

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('captureId');
        if (!id) {
            this.error.set('That link is missing an id.');
            this.loading.set(false);
            return;
        }

        this.api.getStatus(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: status => {
                    this.status.set(status);
                    this.loading.set(false);
                    if (!status.shareUrl) {
                        this.error.set('Your GIF is still being prepared. Try refreshing in a moment.');
                    }
                },
                error: err => {
                    this.loading.set(false);
                    this.error.set(err?.status === 404
                        ? 'We could not find that GIF.'
                        : 'Something went wrong loading this page.');
                }
            });
    }

    protected async onNativeShare(): Promise<void> {
        if (!this.canNativeShare()) return;
        try {
            await navigator.share({
                title: 'My photo booth GIF',
                text: 'Check out my photo booth GIF!',
                url: this.landingUrl(),
            });
        } catch {
            // User cancelled or share failed — no-op, the other share options remain.
        }
    }

    protected async onCopy(): Promise<void> {
        const url = this.landingUrl();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        } catch {
            // Ignore — fall back to the social buttons.
        }
    }
}
