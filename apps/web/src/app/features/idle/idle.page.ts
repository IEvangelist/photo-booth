import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnDestroy,
    OnInit,
    computed,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BoothApiService } from '../../core/api/booth-api.service';
import { GalleryItemDto } from '../../core/api/booth-api.types';
import { IconComponent } from '../../core/icons/icon.component';
import { BoothStore } from '../../core/state/booth.store';

const GALLERY_REFRESH_MS = 30_000;
// Slow rotation: 7s feels gallery-pace rather than slideshow-pace, and pairs
// well with a half-second crossfade so transitions are imperceptible. Photo-
// sensitive guests can also opt out via OS-level `prefers-reduced-motion`.
const GALLERY_ROTATE_MS = 7_000;

@Component({
    selector: 'pb-idle',
    standalone: true,
    imports: [IconComponent],
    template: `
        <section class="kiosk-shell idle">
            <p class="kiosk-subtitle">Welcome to the</p>
            <h1 class="kiosk-title">Photo Booth</h1>

            <button type="button" class="cta-pill tap-btn" (click)="onStart()" [disabled]="loading()">
                <pb-icon name="camera" [size]="28"></pb-icon>
                <span>{{ loading() ? 'Loading…' : 'Tap to start' }}</span>
            </button>

            @if (error()) {
                <p class="banner-error">{{ error() }}</p>
            }

            <ul class="hint-row">
                <li><pb-icon name="camera" [size]="22" /><span>3 photos</span></li>
                <li class="sep" aria-hidden="true">·</li>
                <li><pb-icon name="film" [size]="22" /><span>animated GIF</span></li>
                <li class="sep" aria-hidden="true">·</li>
                <li><pb-icon name="message-square" [size]="22" /><span>texted to you</span></li>
            </ul>

            @if (gallery().length > 0) {
                <aside class="gallery" aria-label="Recent moments at the booth">
                    <div class="gallery-card">
                        <a [href]="currentLanding()" target="_blank" rel="noopener" class="gallery-link" aria-label="Open recent capture">
                            <img class="gallery-img"
                                 [src]="currentThumb()"
                                 [attr.alt]="'recent capture ' + (galleryIndex() + 1)" />
                        </a>
                        @if (gallery().length > 1) {
                            <div class="gallery-pips">
                                @for (item of gallery(); track item.captureId; let i = $index) {
                                    <span class="pip" [class.active]="i === galleryIndex()"></span>
                                }
                            </div>
                        }
                    </div>
                    <p class="gallery-caption">
                        <pb-icon name="sparkles" [size]="16" />
                        <span>Recent at the booth</span>
                    </p>
                </aside>
            }
        </section>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .idle { gap: clamp(1.25rem, 3vw, 3rem); }
        .tap-btn {
            animation: pulse 2.4s ease-in-out infinite;
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
        }
        .hint-row {
            list-style: none;
            margin: 0;
            padding: 0;
            display: inline-flex;
            align-items: center;
            gap: 0.85rem;
            color: #b6becf;
            font-size: clamp(0.95rem, 1.3vw, 1.1rem);
            letter-spacing: 0.02em;
        }
        .hint-row li {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
        }
        .hint-row .sep {
            color: #404a5e;
            font-weight: 700;
        }
        .gallery {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .gallery-card {
            position: relative;
            border-radius: 1.25rem;
            overflow: hidden;
            box-shadow: 0 24px 60px -20px rgba(0,0,0,0.6);
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .gallery-link {
            display: block;
            line-height: 0;
        }
        .gallery-img {
            display: block;
            width: clamp(14rem, 26vw, 22rem);
            aspect-ratio: 4 / 3;
            object-fit: cover;
            /* Half-second opacity crossfade between captures so the rotation
               isn't a hard cut. */
            animation: gallery-fade 700ms ease-out;
        }
        .gallery-pips {
            position: absolute;
            inset-inline: 0;
            bottom: 0.5rem;
            display: flex;
            gap: 0.3rem;
            justify-content: center;
        }
        .pip {
            width: 0.4rem;
            height: 0.4rem;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.35);
            transition: background 0.2s ease, transform 0.2s ease;
        }
        .pip.active {
            background: #ef476f;
            transform: scale(1.4);
        }
        .gallery-caption {
            margin: 0.25rem 0 0;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            color: #6b7388;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 0.75rem;
        }
        @keyframes gallery-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 18px 50px -10px rgba(239,71,111,0.45); }
            50% { transform: scale(1.04); box-shadow: 0 28px 60px -10px rgba(239,71,111,0.6); }
        }
        @media (prefers-reduced-motion: reduce) {
            .tap-btn { animation: none; }
            .gallery-img { animation: none; }
            .pip { transition: none; }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdlePage implements OnInit, OnDestroy {
    private readonly api = inject(BoothApiService);
    private readonly store = inject(BoothStore);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly loading = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly gallery = signal<GalleryItemDto[]>([]);
    protected readonly galleryIndex = signal(0);

    /**
     * Show the static PNG thumbnail of the first frame, never the animated GIF.
     * A carousel of looping GIFs is a strobe risk on a public kiosk; falling
     * back to `shareUrl` here is intentional only for legacy captures stitched
     * before thumbnails were introduced — those are filtered out below in
     * `refreshGallery` so they never reach this code path.
     */
    protected readonly currentThumb = computed(
        () => this.gallery()[this.galleryIndex()]?.thumbnailUrl
              ?? this.gallery()[this.galleryIndex()]?.shareUrl
              ?? ''
    );
    protected readonly currentLanding = computed(() => this.gallery()[this.galleryIndex()]?.landingUrl ?? '');

    private rotateHandle?: ReturnType<typeof setInterval>;
    private refreshHandle?: ReturnType<typeof setInterval>;
    private readonly prefersReducedMotion =
        typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    ngOnInit(): void {
        this.store.reset();

        if (!this.store.options()) {
            this.loading.set(true);
            this.api.getOptions()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: opts => {
                        this.store.setOptions(opts);
                        this.loading.set(false);
                    },
                    error: () => {
                        this.error.set('Could not reach the photo booth service. Check that the API is running.');
                        this.loading.set(false);
                    }
                });
        }

        this.refreshGallery();
        this.refreshHandle = setInterval(() => this.refreshGallery(), GALLERY_REFRESH_MS);
        // Honor `prefers-reduced-motion` — show the most-recent capture as a
        // single static still and never advance the carousel for that visitor.
        if (!this.prefersReducedMotion) {
            this.rotateHandle = setInterval(() => {
                const total = this.gallery().length;
                if (total > 1) this.galleryIndex.update(i => (i + 1) % total);
            }, GALLERY_ROTATE_MS);
        }
    }

    ngOnDestroy(): void {
        if (this.rotateHandle) clearInterval(this.rotateHandle);
        if (this.refreshHandle) clearInterval(this.refreshHandle);
    }

    protected onStart(): void {
        if (this.loading()) return;
        if (!this.store.options()) {
            this.error.set('Booth is still loading. Try again in a moment.');
            return;
        }
        // New flow: skip the number pad on the way in. Phone collection happens
        // on the way out, after the customer has seen and approved their shots.
        void this.router.navigate(['/capture']);
    }

    private refreshGallery(): void {
        this.api.getGallery(12)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: response => {
                    // Only show captures that have a static PNG thumbnail.
                    // Legacy captures (pre-thumbnail) are silently skipped to
                    // avoid playing animated GIFs in a rotating carousel.
                    const items = (response.items ?? []).filter(i => !!i.thumbnailUrl);
                    this.gallery.set(items);
                    if (this.galleryIndex() >= items.length) {
                        this.galleryIndex.set(0);
                    }
                },
                error: () => {
                    // Silent — gallery is decorative; CTA still works.
                }
            });
    }
}
