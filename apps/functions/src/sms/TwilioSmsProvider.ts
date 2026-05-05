import { InvocationContext } from "@azure/functions";
import twilio from "twilio";
import { ISmsProvider, SmsResult } from "./ISmsProvider.js";

type TwilioClient = ReturnType<typeof twilio>;

export class TwilioSmsProvider implements ISmsProvider {
    readonly name = "twilio";
    private readonly client: TwilioClient;
    private readonly fromPhone: string;

    constructor() {
        const sid = requiredEnv("TWILIO_ACCOUNT_SID");
        const token = requiredEnv("TWILIO_AUTH_TOKEN");
        this.fromPhone = requiredEnv("TWILIO_FROM_PHONE");
        this.client = twilio(sid, token);
    }

    async send(toPhone: string, body: string, context: InvocationContext): Promise<SmsResult> {
        try {
            const message = await this.client.messages.create({
                from: this.fromPhone,
                to: toPhone,
                body,
            });

            return {
                success: true,
                providerMessageId: message.sid,
            };
        } catch (err) {
            context.error("TwilioSmsProvider.send failed", err);
            return { success: false, error: (err as Error).message };
        }
    }
}

function requiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}
