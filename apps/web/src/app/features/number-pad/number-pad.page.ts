import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BoothApiService } from '../../core/api/booth-api.service';
import { IconComponent } from '../../core/icons/icon.component';
import { BoothStore } from '../../core/state/booth.store';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'] as const;
const E164 = /^\+\d{8,15}$/;

@Component({
    selector: 'pb-number-pad',
    standalone: true,
    imports: [IconComponent],
    template: `
        <section class="kiosk-shell pad">
            <h1 class="kiosk-title small">Where should we send it?</h1>
            <p class="kiosk-subtitle">Drop in your phone number and we'll text you a link to your GIF.</p>

            <div class="display" [class.invalid]="!isValid() && entered().length > 0">
                <span>{{ display() }}</span>
            </div>

            <div class="grid">
                @for (key of keys; track key) {
                    <button type="button" class="key" (click)="press(key)" [disabled]="sending()">{{ key }}</button>
                }
            </div>

            @if (error()) {
                <p class="banner-error">{{ error() }}</p>
            }

            <div class="actions">
                <button type="button" class="ghost" (click)="cancel()" [disabled]="sending()">
                    <pb-icon name="refresh" [size]="18" />
                    <span>Start over</span>
                </button>
                <button type="button" class="cta-pill" (click)="submit()" [disabled]="!isValid() || sending()">
                    @if (sending()) {
                        <span>Sending…</span>
                    } @else {
                        <pb-icon name="message-square" [size]="22" />
                        <span>Text me my GIF</span>
                    }
                </button>
            </div>
            <p class="kbd-hint">Tip: keyboard works too — digits, <kbd>+</kbd>, <kbd>Backspace</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>.</p>
        </section>
    `,
    styles: [`
        .pad { gap: clamp(1rem, 2vw, 1.6rem); }
        .small { font-size: clamp(1.4rem, 4vw, 3rem); }
        .display {
            font-size: clamp(2rem, 6vw, 4rem);
            font-weight: 700;
            letter-spacing: 0.18em;
            padding: 1rem 2rem;
            border-radius: 1rem;
            min-width: 24rem;
            background: rgba(255, 255, 255, 0.04);
            border: 2px solid rgba(255, 255, 255, 0.08);
            text-align: center;
            min-height: 5rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .display.invalid { border-color: rgba(239, 71, 111, 0.6); }
        .grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(5rem, 7rem));
            gap: 0.75rem;
        }
        .key {
            font-size: 2rem;
            padding: 1.2rem 0;
            border-radius: 1rem;
            background: rgba(255, 255, 255, 0.06);
            transition: background 0.1s ease, transform 0.1s ease;
        }
        .key:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
        .key:active:not(:disabled) { transform: scale(0.95); background: rgba(255, 255, 255, 0.18); }
        .key:disabled { opacity: 0.5; cursor: not-allowed; }
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
        .kbd-hint {
            color: #6b7388;
            font-size: 0.85rem;
            letter-spacing: 0.04em;
        }
        kbd {
            font-family: inherit;
            font-size: 0.8rem;
            padding: 0.1rem 0.4rem;
            border-radius: 0.3rem;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
    `],
    host: {
        '(document:keydown)': 'onKeydown($event)'
    },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberPadPage {
    private readonly store = inject(BoothStore);
    private readonly router = inject(Router);
    private readonly api = inject(BoothApiService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly keys = KEYS;
    protected readonly entered = signal<string>(this.store.phoneNumber() || '+1');
    protected readonly sending = signal(false);
    protected readonly error = signal<string | null>(null);

    protected readonly display = computed(() => this.entered() || '+');
    protected readonly isValid = computed(() => E164.test(this.entered()));

    press(key: string): void {
        if (this.sending()) return;
        const current = this.entered();
        if (key === '⌫') {
            this.entered.set(current.length > 0 ? current.slice(0, -1) : '');
            return;
        }
        if (key === '+') {
            // Only allow + at the start
            if (current.length === 0) {
                this.entered.set('+');
            }
            return;
        }
        if (current.length >= 16) return;
        this.entered.set(current + key);
    }

    cancel(): void {
        if (this.sending()) return;
        this.store.reset();
        void this.router.navigate(['/']);
    }

    submit(): void {
        if (!this.isValid() || this.sending()) return;

        const phone = this.entered();
        const frames = this.store.frames();
        if (!frames.length) {
            // Customer landed on /phone without any captured frames — bounce back to start.
            this.error.set('No photos in this session. Please start over.');
            return;
        }

        this.store.setPhone(phone);
        this.sending.set(true);
        this.error.set(null);

        this.api.createCapture({ phone, frames })
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

    protected onKeydown(event: KeyboardEvent): void {
        // Ignore modified key combos so browser shortcuts (Ctrl+R, Cmd+L, …) still work.
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const { key } = event;
        if (/^[0-9]$/.test(key)) {
            this.press(key);
        } else if (key === '+') {
            this.press('+');
        } else if (key === 'Backspace') {
            this.press('⌫');
        } else if (key === 'Enter') {
            this.submit();
        } else if (key === 'Escape') {
            this.cancel();
        } else {
            return; // unhandled — let the event propagate normally
        }
        event.preventDefault();
    }
}
