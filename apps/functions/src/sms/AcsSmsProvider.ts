import { InvocationContext } from "@azure/functions";
import { SmsClient } from "@azure/communication-sms";
import { ISmsProvider, SmsResult } from "./ISmsProvider.js";

export class AcsSmsProvider implements ISmsProvider {
    readonly name = "acs";
    private readonly client: SmsClient;
    private readonly fromPhone: string;

    constructor() {
        const connectionString = requiredEnv("ACS_CONNECTION_STRING");
        this.fromPhone = requiredEnv("ACS_FROM_PHONE");
        this.client = new SmsClient(connectionString);
    }

    async send(toPhone: string, body: string, context: InvocationContext): Promise<SmsResult> {
        try {
            const results = await this.client.send({
                from: this.fromPhone,
                to: [toPhone],
                message: body,
            });

            const first = results[0];
            if (!first?.successful) {
                return {
                    success: false,
                    error: first?.errorMessage ?? "ACS send returned no successful result",
                };
            }

            return {
                success: true,
                providerMessageId: first.messageId,
            };
        } catch (err) {
            context.error("AcsSmsProvider.send failed", err);
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
