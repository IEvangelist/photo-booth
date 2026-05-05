import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Inline SVG icon set tuned for kiosk use. Stroke = currentColor so callers
// style the colour via CSS. Lucide-style outlines, 24×24 viewBox.
//
// Renders inside a single template via `@switch` so Angular's SVG binding stays
// happy and the icon set is tree-shaken into the final bundle.
export type IconName =
    | 'camera'
    | 'film'
    | 'message-square'
    | 'sparkles'
    | 'arrow-right'
    | 'refresh'
    | 'download'
    | 'copy'
    | 'share'
    | 'check-circle'
    | 'qr'
    | 'twitter'
    | 'facebook'
    | 'whatsapp'
    | 'mail';

@Component({
    selector: 'pb-icon',
    template: `<svg xmlns="http://www.w3.org/2000/svg" [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (name()) {
            @case ('camera') {
                <rect x="3" y="6.5" width="18" height="13" rx="2.2"/>
                <path d="M7.5 6.5l1.5-2.5h6l1.5 2.5"/>
                <circle cx="12" cy="13" r="3.7"/>
            }
            @case ('film') {
                <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="2.2"/>
                <path d="M7.5 4.2v15.6M16.5 4.2v15.6M3.2 9h4.3M3.2 15h4.3M16.5 9h4.3M16.5 15h4.3"/>
            }
            @case ('message-square') {
                <path d="M21 12.5a8 8 0 0 1-11.6 7.1L4 21l1.4-5.4A8 8 0 1 1 21 12.5z"/>
            }
            @case ('sparkles') {
                <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4-4.4-1.6 4.4-1.6z"/>
                <path d="M18.5 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>
                <path d="M6 3l.6 1.6L8.2 5.2l-1.6.6L6 7.4l-.6-1.6L3.8 5.2l1.6-.6z"/>
            }
            @case ('arrow-right') {
                <path d="M5 12h14M13 5l7 7-7 7"/>
            }
            @case ('refresh') {
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/>
            }
            @case ('download') {
                <path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>
            }
            @case ('copy') {
                <rect x="8.5" y="8.5" width="11" height="11" rx="2"/>
                <path d="M5 15.5V6a2 2 0 0 1 2-2h9.5"/>
            }
            @case ('share') {
                <circle cx="6" cy="12" r="2.5"/>
                <circle cx="18" cy="6" r="2.5"/>
                <circle cx="18" cy="18" r="2.5"/>
                <path d="M8.2 11l7.6-3.6M8.2 13l7.6 3.6"/>
            }
            @case ('check-circle') {
                <circle cx="12" cy="12" r="9"/>
                <path d="M8 12.5l3 3 5-6"/>
            }
            @case ('qr') {
                <rect x="3.5" y="3.5" width="6" height="6" rx="0.5"/>
                <rect x="14.5" y="3.5" width="6" height="6" rx="0.5"/>
                <rect x="3.5" y="14.5" width="6" height="6" rx="0.5"/>
                <path d="M14.5 14.5h2.5v2.5h-2.5zM18.5 14.5h2v2h-2zM14.5 18.5h2v2h-2zM18.5 18.5h2v2h-2z"/>
            }
            @case ('twitter') {
                <path d="M18 5h2.5l-5.5 6.3L21.5 20H17l-3.7-4.6L9 20H6.5l5.9-6.7L6 5h4.6l3.4 4.3z"/>
            }
            @case ('facebook') {
                <path d="M14 21v-7.5h2.5l.4-3H14V8.6c0-.9.3-1.5 1.6-1.5h1.7V4.4A23 23 0 0 0 14.6 4c-2.6 0-4.4 1.6-4.4 4.4v2.1H7.5v3H10.2V21z"/>
            }
            @case ('whatsapp') {
                <path d="M20 12a8 8 0 1 1-14.7 4.4L4 20l3.7-1.2A8 8 0 0 1 20 12z"/>
                <path d="M9 9.5c.4 0 .8.6 1 1.1.2.5-.2 1-.4 1.2-.2.2.1.7.6 1.4.6.7 1 1 1.4 1.1.4 0 .7-.4 1-.6.3-.2.7 0 1.1.2.4.3.9.6 1 .8.2.3-.6 1.5-2.1 1.5-1.8 0-3.6-1.4-4.6-2.7-.9-1.3-1.2-2.2-1-2.8.2-.6.7-1 1.1-1.1z"/>
            }
            @case ('mail') {
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 7l9 6.5L21 7"/>
            }
        }
    </svg>`,
    styles: [`
        :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
        svg { display: block; }
    `],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
    readonly name = input.required<IconName>();
    readonly size = input<number>(24);
}
