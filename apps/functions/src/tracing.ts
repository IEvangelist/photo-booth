// Initializes OpenTelemetry tracing for the Functions worker.
// Imported FIRST from index.ts so auto-instrumentations attach before any
// `@azure/*` clients or function handlers are constructed.
//
// All wiring is gated on `OTEL_EXPORTER_OTLP_ENDPOINT` so this is a no-op
// when the worker runs outside Aspire (e.g. unit tests, ad-hoc func start).
//
// Local-dev caveat: Aspire's dashboard OTLP collector uses a self-signed
// dev cert and the `@grpc/grpc-js` client doesn't honor
// `NODE_TLS_REJECT_UNAUTHORIZED`. As a result, traces may not always reach
// the *local* dashboard during `aspire start`; the AppHost sets
// `NODE_TLS_REJECT_UNAUTHORIZED=0` as a best-effort dev bypass. In a
// deployed environment the collector uses a trusted cert and traces flow
// without intervention. Spans are still created locally either way, so
// downstream tooling that prefers HTTP/protobuf can opt in by setting
// `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`.

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
    if (process.env.OTEL_DIAG_LOG_LEVEL?.toLowerCase() === "debug") {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter(),
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: 30_000,
        }),
        instrumentations: [
            getNodeAutoInstrumentations({
                // fs is extremely chatty inside the Functions host; opt out.
                "@opentelemetry/instrumentation-fs": { enabled: false },
            }),
        ],
    });

    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[otel] tracing started → ${endpoint}`);

    const shutdown = (): void => {
        void sdk.shutdown().catch(err => console.error("[otel] shutdown error", err));
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
}
