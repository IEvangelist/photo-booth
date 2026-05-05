import { ISmsProvider } from "./ISmsProvider.js";
import { LogSmsProvider } from "./LogSmsProvider.js";

let cached: ISmsProvider | undefined;

/**
 * Lazily resolves the SMS provider from the SMS_PROVIDER env var.
 * Defaults to LogSmsProvider so local dev works with zero credentials.
 *
 * The ACS / Twilio providers are imported lazily so a missing optional
 * dependency at runtime doesn't blow up the worker for users on the log path.
 */
export async function getSmsProvider(): Promise<ISmsProvider> {
    if (cached) {
        return cached;
    }

    const choice = (process.env.SMS_PROVIDER ?? "log").toLowerCase();

    switch (choice) {
        case "acs": {
            const { AcsSmsProvider } = await import("./AcsSmsProvider.js");
            cached = new AcsSmsProvider();
            break;
        }
        case "twilio": {
            const { TwilioSmsProvider } = await import("./TwilioSmsProvider.js");
            cached = new TwilioSmsProvider();
            break;
        }
        case "log":
        default:
            cached = new LogSmsProvider();
            break;
    }

    return cached;
}
