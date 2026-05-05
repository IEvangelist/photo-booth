import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "gifenc/dist/gifenc.esm.js";

export interface DecodedFrame {
    width: number;
    height: number;
    rgba: Uint8Array;
}

export function decodePng(buffer: Buffer): DecodedFrame {
    const png = PNG.sync.read(buffer);
    return {
        width: png.width,
        height: png.height,
        rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    };
}

/**
 * Stitches a list of RGBA frames into an animated GIF.
 * frameDelayMs is converted to GIF's centiseconds (×0.1).
 */
export function encodeAnimatedGif(frames: DecodedFrame[], frameDelayMs: number): Uint8Array {
    if (frames.length === 0) {
        throw new Error("encodeAnimatedGif requires at least one frame");
    }

    const { width, height } = frames[0];
    for (const f of frames) {
        if (f.width !== width || f.height !== height) {
            throw new Error(`Frame size mismatch: expected ${width}x${height}, got ${f.width}x${f.height}`);
        }
    }

    const gif = GIFEncoder();
    const delay = Math.max(2, Math.round(frameDelayMs / 10)); // GIF delay is in centiseconds

    for (const frame of frames) {
        const palette = quantize(frame.rgba, 256);
        const indexed = applyPalette(frame.rgba, palette);
        gif.writeFrame(indexed, width, height, { palette, delay, repeat: 0 });
    }

    gif.finish();
    return gif.bytes();
}
