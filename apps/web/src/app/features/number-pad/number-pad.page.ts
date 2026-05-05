import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BoothStore } from '../../core/state/booth.store';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'] as const;
const E164 = /^\+\d{8,15}$/;

@Component({
    selector: 'pb-number-pad',
    template: `
        <section class="kiosk-shell pad">
            <h1 class="kiosk-title small">Your phone number</h1>
            <p class="kiosk-subtitle">We'll text you the link to your GIF.</p>

            <div class="display" [class.invalid]="!isValid() && entered().length > 0">
                <span>{{ display() }}</span>
            </div>

            <div class="grid">
                @for (key of keys; track key) {
                    <button type="button" class="key" (click)="press(key)">{{ key }}</button>
                }
            </div>

            <div class="actions">
                <button type="button" class="ghost" (click)="cancel()">Cancel</button>
                <button type="button" class="cta-pill" (click)="submit()" [disabled]="!isValid()">Take photos</button>
            </div>
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
        .key:hover { background: rgba(255, 255, 255, 0.1); }
        .key:active { transform: scale(0.95); background: rgba(255, 255, 255, 0.18); }
        .actions { display: flex; gap: 1rem; }
        .ghost {
            padding: 1rem 2rem;
            border-radius: 9999px;
            color: #b6becf;
            font-weight: 600;
        }
        .ghost:hover { background: rgba(255, 255, 255, 0.06); }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberPadPage {
    private readonly store = inject(BoothStore);
    private readonly router = inject(Router);

    protected readonly keys = KEYS;
    protected readonly entered = signal<string>(this.store.phoneNumber() || '+1');

    protected readonly display = computed(() => this.entered() || '+');
    protected readonly isValid = computed(() => E164.test(this.entered()));

    press(key: string): void {
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
        this.store.reset();
        void this.router.navigate(['/']);
    }

    submit(): void {
        if (!this.isValid()) return;
        this.store.setPhone(this.entered());
        void this.router.navigate(['/capture']);
    }
}
