import { app, InvocationContext } from "@azure/functions";
import { postStatus } from "../api/statusClient.js";
import { getSmsProvider } from "../sms/factory.js";

interface SmsMessage {
    captureId: string;
    phone: string;
    shareUrl: string;
}

app.storageQueue("dispatchSms", {
    connection: "AzureWebJobsStorage",
    queueName: process.env.QUEUE_SMS ?? "sms-requests",
    handler: async (queueItem: unknown, context: InvocationContext) => {
        const message = parseMessage(queueItem);
        if (!message) {
            context.warn("dispatchSms: invalid queue message", queueItem);
            return;
        }

        const { captureId, phone, shareUrl } = message;
        context.log(`dispatchSms: ${captureId} → ${phone}`);

        await postStatus({ captureId, state: "sending" }, context);

        const provider = await getSmsProvider();
        const body = `Your photo booth GIF is ready! ${shareUrl}`;

        const result = await provider.send(phone, body, context);

        if (result.success) {
            await postStatus({
                captureId,
                state: "sent",
                shareUrl,
                providerMessageId: result.providerMessageId,
            }, context);
        } else {
            // SMS failure post-upload does NOT erase the share URL — kiosk falls
            // back to "scan the QR" UX. We mark the row sms_failed but keep the
            // share URL for the snapshot.
            await postStatus({
                captureId,
                state: "sms_failed",
                shareUrl,
                error: result.error ?? "SMS send failed",
            }, context);
        }
    },
});

function parseMessage(item: unknown): SmsMessage | null {
    if (typeof item === "string") {
        try {
            return JSON.parse(item) as SmsMessage;
        } catch {
            return null;
        }
    }
    if (item && typeof item === "object" && "captureId" in item) {
        return item as SmsMessage;
    }
    return null;
}
