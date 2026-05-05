import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BoothApiService } from '../../core/api/booth-api.service';
import { BoothStore } from '../../core/state/booth.store';

@Component({
    selector: 'pb-idle',
    template: `
        <section class="kiosk-shell idle">
            <p class="kiosk-subtitle">Welcome to the</p>
            <h1 class="kiosk-title">Photo Booth</h1>
            <button type="button" class="cta-pill tap-btn" (click)="onStart()" [disabled]="loading()">
                {{ loading() ? 'Loading…' : 'Tap to start' }}
            </button>
            @if (error()) {
                <p class="banner-error">{{ error() }}</p>
            }
            <p class="hint">3 photos · animated GIF · texted to your phone</p>
        </section>
    `,
    styles: [`
        :host { display: block; height: 100%; }
        .idle { gap: clamp(1.5rem, 4vw, 4rem); }
        .tap-btn {
            animation: pulse 2.4s ease-in-out infinite;
        }
        .hint {
            color: #6b7388;
            font-size: 1rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 18px 50px -10px rgba(239,71,111,0.45); }
            50% { transform: scale(1.04); box-shadow: 0 28px 60px -10px rgba(239,71,111,0.6); }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdlePage implements OnInit {
    private readonly api = inject(BoothApiService);
    private readonly store = inject(BoothStore);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly loading = signal(false);
    protected readonly error = signal<string | null>(null);

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
    }

    protected onStart(): void {
        if (this.loading()) return;
        if (!this.store.options()) {
            this.error.set('Booth is still loading. Try again in a moment.');
            return;
        }
        void this.router.navigate(['/phone']);
    }
}
