import { InvocationContext } from "@azure/functions";
import { ISmsProvider, SmsResult } from "./ISmsProvider.js";

/**
 * Offline / dev provider — just logs the share URL. Used when SMS_PROVIDER=log
 * (the default in local.settings.sample.json) so the full flow runs without
 * any real SMS credentials.
 */
export class LogSmsProvider implements ISmsProvider {
    readonly name = "log";

    async send(toPhone: string, body: string, context: InvocationContext): Promise<SmsResult> {
        context.log(`[LogSmsProvider] Pretending to text ${toPhone}: ${body}`);
        return {
            success: true,
            providerMessageId: `log-${Date.now()}`,
        };
    }
}
