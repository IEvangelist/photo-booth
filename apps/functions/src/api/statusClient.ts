import { InvocationContext } from "@azure/functions";

export type CaptureState =
    | "queued"
    | "stitching"
    | "uploaded"
    | "sending"
    | "sent"
    | "stitch_failed"
    | "sms_failed";

export interface StatusUpdate {
    captureId: string;
    state: CaptureState;
    shareUrl?: string;
    error?: string;
    providerMessageId?: string;
}

/**
 * POSTs a status update to the API's internal webhook. Best-effort: failures are
 * logged but don't propagate, so a transient API hiccup doesn't poison the queue
 * trigger and double-process the message.
 */
export async function postStatus(update: StatusUpdate, context: InvocationContext): Promise<void> {
    const baseUrl = process.env.API_BASE_URL;
    const secret = process.env.INTERNAL_WEBHOOK_SECRET;
    if (!baseUrl || !secret) {
        context.warn("API_BASE_URL or INTERNAL_WEBHOOK_SECRET is not set; skipping postStatus", update);
        return;
    }

    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Auth": secret,
            },
            body: JSON.stringify(update),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            context.warn(`postStatus → ${response.status} ${response.statusText}: ${body}`);
        }
    } catch (err) {
        context.warn("postStatus failed", err);
    }
}
