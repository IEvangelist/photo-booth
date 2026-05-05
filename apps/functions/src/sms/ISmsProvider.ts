import { InvocationContext } from "@azure/functions";

export interface SmsResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface ISmsProvider {
    readonly name: string;
    send(toPhone: string, body: string, context: InvocationContext): Promise<SmsResult>;
}
