import { app, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { decodePng, encodePng, encodeAnimatedGif, DecodedFrame } from "../gif/encoder.js";
import { postStatus } from "../api/statusClient.js";

interface StitchMessage {
    captureId: string;
}

const blobConnection = () => required("ConnectionStrings__blobs");
const rawContainer = () => process.env.BLOB_RAW_CONTAINER ?? "photoboothraw";
const shareContainer = () => process.env.BLOB_SHARE_CONTAINER ?? "photoboothshare";
const frameDelayMs = () => Number.parseInt(process.env.FRAME_DELAY_MS ?? "333", 10);
const publicBaseUrl = () => (process.env.BOOTH_PUBLIC_URL ?? "").replace(/\/$/, "");
const landingUrlFor = (captureId: string): string | undefined => {
    const base = publicBaseUrl();
    return base ? `${base}/g/${captureId}` : undefined;
};

app.storageQueue("stitchGif", {
    connection: "AzureWebJobsStorage",
    queueName: process.env.QUEUE_STITCH ?? "stitch-requests",
    handler: async (queueItem: unknown, context: InvocationContext) => {
        const message = parseMessage(queueItem);
        if (!message) {
            context.warn("stitchGif: invalid queue message", queueItem);
            return;
        }

        const { captureId } = message;
        context.log(`stitchGif: ${captureId}`);

        await postStatus({ captureId, state: "stitching" }, context);

        try {
            const blobs = BlobServiceClient.fromConnectionString(blobConnection());
            const raw = blobs.getContainerClient(rawContainer());
            const share = blobs.getContainerClient(shareContainer());

            // Idempotency: if the share GIF already exists, skip stitch and just postback.
            const shareBlob = share.getBlockBlobClient(`${captureId}.gif`);
            const thumbBlob = share.getBlockBlobClient(`${captureId}-thumb.png`);
            if (await shareBlob.exists()) {
                const shareUrl = shareBlob.url;
                const thumbnailUrl = (await thumbBlob.exists()) ? thumbBlob.url : undefined;
                context.log(`stitchGif: ${captureId} already stitched at ${shareUrl}, skipping`);
                await postStatus({
                    captureId,
                    state: "uploaded",
                    shareUrl,
                    thumbnailUrl,
                    landingUrl: landingUrlFor(captureId),
                }, context);
                return;
            }

            // Pull all frames for this capture from the raw container.
            const frames: DecodedFrame[] = [];
            for await (const blob of raw.listBlobsFlat({ prefix: `${captureId}/` })) {
                const blobClient = raw.getBlobClient(blob.name);
                const buffer = await blobClient.downloadToBuffer();
                frames.push(decodePng(buffer));
            }

            if (frames.length === 0) {
                throw new Error(`No frames found for capture ${captureId}`);
            }

            const gif = encodeAnimatedGif(frames, frameDelayMs());
            await shareBlob.uploadData(Buffer.from(gif), {
                blobHTTPHeaders: { blobContentType: "image/gif" },
            });

            // Static thumbnail = first frame as a PNG. The idle-screen gallery
            // shows these (instead of the animated GIFs) so a rotating carousel
            // of captures isn't a strobe risk.
            let thumbnailUrl: string | undefined;
            try {
                const thumbBytes = encodePng(frames[0]);
                await thumbBlob.uploadData(thumbBytes, {
                    blobHTTPHeaders: { blobContentType: "image/png" },
                });
                thumbnailUrl = thumbBlob.url;
            } catch (thumbErr) {
                context.warn(`stitchGif: thumbnail upload failed for ${captureId}`, thumbErr);
            }

            const shareUrl = shareBlob.url;
            context.log(`stitchGif: uploaded ${shareUrl}`);
            await postStatus({
                captureId,
                state: "uploaded",
                shareUrl,
                thumbnailUrl,
                landingUrl: landingUrlFor(captureId),
            }, context);

            // Best-effort cleanup of raw frames now that the share GIF is durable.
            for await (const blob of raw.listBlobsFlat({ prefix: `${captureId}/` })) {
                try {
                    await raw.deleteBlob(blob.name);
                } catch (err) {
                    context.warn(`stitchGif: failed to delete raw blob ${blob.name}`, err);
                }
            }
        } catch (err) {
            const e = err as { message?: string; code?: string; statusCode?: number };
            const message = e.message ?? String(err);
            context.error(`stitchGif: ${captureId} failed (status=${e.statusCode ?? "?"} code=${e.code ?? "?"}): ${message}`);
            await postStatus({ captureId, state: "stitch_failed", error: message }, context);
            throw err; // Let the queue handle the retry budget (see host.json maxDequeueCount).
        }
    },
});

function parseMessage(item: unknown): StitchMessage | null {
    if (typeof item === "string") {
        try {
            return JSON.parse(item) as StitchMessage;
        } catch {
            return null;
        }
    }
    if (item && typeof item === "object" && "captureId" in item) {
        return item as StitchMessage;
    }
    return null;
}

function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}
