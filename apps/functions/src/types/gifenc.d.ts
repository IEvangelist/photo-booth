// Minimal type stubs for `gifenc` (no upstream @types package).
// Covers exactly the surface we use in src/gif/encoder.ts.
declare module "gifenc" {
    export interface GifEncoderInstance {
        writeFrame(
            indexedPixels: Uint8Array,
            width: number,
            height: number,
            options?: {
                palette?: number[][];
                delay?: number;
                repeat?: number;
                transparent?: boolean;
                transparentIndex?: number;
                dispose?: number;
                first?: boolean;
            }
        ): void;
        finish(): void;
        bytes(): Uint8Array;
        bytesView(): Uint8Array;
        reset(): void;
    }

    export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance;
    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
        options?: { format?: "rgb444" | "rgb565" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }
    ): number[][];
    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: number[][],
        format?: "rgb444" | "rgb565" | "rgba4444"
    ): Uint8Array;
    export function nearestColorIndex(palette: number[][], pixel: number[]): number;
    export function snapColorsToPalette(palette: number[][], rgba: Uint8Array): void;

    const _default: {
        GIFEncoder: typeof GIFEncoder;
        quantize: typeof quantize;
        applyPalette: typeof applyPalette;
        nearestColorIndex: typeof nearestColorIndex;
        snapColorsToPalette: typeof snapColorsToPalette;
    };
    export default _default;
}

declare module "gifenc/dist/gifenc.esm.js" {
    export interface GifEncoderInstance {
        writeFrame(
            indexedPixels: Uint8Array,
            width: number,
            height: number,
            options?: {
                palette?: number[][];
                delay?: number;
                repeat?: number;
                transparent?: boolean;
                transparentIndex?: number;
                dispose?: number;
                first?: boolean;
            }
        ): void;
        finish(): void;
        bytes(): Uint8Array;
        bytesView(): Uint8Array;
        reset(): void;
    }

    export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance;
    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
        options?: { format?: "rgb444" | "rgb565" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }
    ): number[][];
    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: number[][],
        format?: "rgb444" | "rgb565" | "rgba4444"
    ): Uint8Array;

    const _default: {
        GIFEncoder: typeof GIFEncoder;
        quantize: typeof quantize;
        applyPalette: typeof applyPalette;
    };
    export default _default;
}

