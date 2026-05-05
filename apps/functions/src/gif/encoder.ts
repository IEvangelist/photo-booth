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
 * Re-encodes an in-memory RGBA frame as a PNG buffer. Used to generate the
 * static gallery thumbnail (a snapshot of the first capture frame) so the
 * idle-screen carousel doesn't have to play animated GIFs.
 */
export function encodePng(frame: DecodedFrame): Buffer {
    const png = new PNG({ width: frame.width, height: frame.height });
    png.data = Buffer.from(frame.rgba.buffer, frame.rgba.byteOffset, frame.rgba.byteLength);
    return PNG.sync.write(png);
}

/**
 * Stitches a list of RGBA frames into an animated GIF.
 *
 * `frameDelayMs` is the human-readable per-frame delay. `gifenc` accepts
 * milliseconds directly and converts to GIF's native 1/100-second units
 * internally, so we pass `frameDelayMs` through unchanged. (We previously
 * divided by 10 here, which double-converted the value and produced a GIF
 * that played 10× too fast — closer to a strobe than a photo-booth
 * stop-motion.)
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
    // gifenc expects ms; minimum 20ms (≈50fps cap) keeps malformed callers
    // from producing unreadably-fast GIFs.
    const delay = Math.max(20, Math.round(frameDelayMs));

    for (const frame of frames) {
        const palette = quantize(frame.rgba, 256);
        const indexed = applyPalette(frame.rgba, palette);
        gif.writeFrame(indexed, width, height, { palette, delay, repeat: 0 });
    }

    gif.finish();
    return gif.bytes();
}
