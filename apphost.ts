// Aspire TypeScript AppHost — orchestrates Azurite + API + Functions + Web.
// Run with `aspire start` from the repo root.

import { createBuilder } from './.modules/aspire.js';

const builder = await createBuilder();

// Shared secret for the Functions → API webhook callback.
const internalWebhookSecret = builder.addParameterWithGeneratedValue(
    'internal-webhook-secret',
    { minLength: 32, lower: true, upper: true, numeric: true, special: false },
    { secret: true, persist: true }
);

// SMS provider toggle: log | acs | twilio. Default to log so local dev needs zero credentials.
const smsProvider = builder.addParameter('sms-provider', { value: 'log' });

// Public origin where the kiosk SPA is reachable. Used by the Functions worker
// to build the landing-page URL (`{BOOTH_PUBLIC_URL}/g/{captureId}`) that gets
// texted to the recipient and rendered as the QR code on the kiosk.
const boothPublicUrl = builder.addParameter('booth-public-url', { value: 'http://localhost:4200' });

// First-class Azure Storage resource backed by an Azurite container in dev.
// Pinning the standard emulator ports keeps `UseDevelopmentStorage=true` viable
// for tools (like the Functions host) that expect them.
// `--skipApiVersionCheck` lets the JS storage SDK's default service version
// (currently `2026-02-06`) through Azurite 3.35.0, which otherwise rejects it
// with `InvalidHeaderValue`. (`withApiVersionCheck({enable:false})` is a no-op
// at the container-arg level in Aspire 13.3.0, so we add the flag explicitly.)
const storage = builder
    .addAzureStorage('storage')
    .runAsEmulator({
        configureContainer: async c => {
            await c
                .withImageTag('latest')
                .withBlobPort(10000)
                .withQueuePort(10001)
                .withTablePort(10002)
                .withDataVolume({ name: 'photo-booth-azurite-data' })
                .withArgs(['--skipApiVersionCheck']);
        },
    });

const blobs = storage.addBlobs('blobs');
const queues = storage.addQueues('queues');
const tables = storage.addTables('tables');

const api = builder
    .addProject('api', 'apps/api/PhotoBooth.Api.csproj')
    .withReference(blobs)
    .withReference(queues)
    .withReference(tables)
    .waitFor(blobs)
    .waitFor(queues)
    .waitFor(tables)
    .withEnvironment('INTERNAL_WEBHOOK_SECRET', internalWebhookSecret);

await builder
    .addExecutable('functions', 'npx', 'apps/functions',
        ['--yes', 'func', 'start', '--port', '7071', '--no-build'])
    .withReference(blobs)
    .withReference(queues)
    .withReference(tables)
    .waitFor(blobs)
    .waitFor(queues)
    .waitFor(tables)
    .waitFor(api)
    .withHttpEndpoint({ port: 7071, targetPort: 7071, name: 'http', isProxied: false })
    .withOtlpExporter()
    .withEnvironment('FUNCTIONS_WORKER_RUNTIME', 'node')
    // Functions host needs blobs+queues+tables internally; the standard
    // emulator string resolves to the pinned ports above.
    .withEnvironment('AzureWebJobsStorage', 'UseDevelopmentStorage=true')
    .withEnvironment('API_BASE_URL', api.getEndpoint('http'))
    .withEnvironment('BOOTH_PUBLIC_URL', boothPublicUrl)
    .withEnvironment('INTERNAL_WEBHOOK_SECRET', internalWebhookSecret)
    .withEnvironment('SMS_PROVIDER', smsProvider)
    .withEnvironment('OTEL_SERVICE_NAME', 'photo-booth-functions')
    .withEnvironment('OTEL_RESOURCE_ATTRIBUTES', 'service.name=photo-booth-functions,service.namespace=photo-booth')
    // Aspire's local OTLP collector runs with a self-signed dev cert. Best-
    // effort bypass for the Node TLS stack (grpc-js doesn't honor it, so
    // local-dashboard delivery is not guaranteed in dev — see tracing.ts).
    .withEnvironment('NODE_TLS_REJECT_UNAUTHORIZED', '0')
    .withEnvironment('AzureFunctionsJobHost__logging__console__isEnabled', 'true');

await builder
    .addExecutable('web', 'npm', 'apps/web',
        ['start', '--', '--host', '0.0.0.0', '--port', '4200'])
    .waitFor(api)
    .withHttpEndpoint({ port: 4200, targetPort: 4200, name: 'ui', isProxied: false })
    .withEnvironment('API_URL', api.getEndpoint('http'));

await builder.build().run();
