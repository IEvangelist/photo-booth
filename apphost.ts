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

// Azurite (Blob + Queue + Table) on the well-known dev-storage ports so
// `UseDevelopmentStorage=true` "just works" for both the .NET API and Node Functions.
const azurite = builder
    .addContainer('azurite', { image: 'mcr.microsoft.com/azure-storage/azurite', tag: 'latest' })
    .withHttpEndpoint({ port: 10000, targetPort: 10000, name: 'blob', isProxied: false })
    .withHttpEndpoint({ port: 10001, targetPort: 10001, name: 'queue', isProxied: false })
    .withHttpEndpoint({ port: 10002, targetPort: 10002, name: 'table', isProxied: false })
    .withVolume('/data', { name: 'photo-booth-azurite-data' })
    .withArgs([
        'azurite',
        '--blobHost', '0.0.0.0',
        '--queueHost', '0.0.0.0',
        '--tableHost', '0.0.0.0',
        '--location', '/data',
        '--skipApiVersionCheck'
    ]);

const azuriteConnectionString = 'UseDevelopmentStorage=true';

const api = builder
    .addProject('api', 'apps/api/PhotoBooth.Api.csproj')
    .waitFor(azurite)
    .withEnvironment('AzureWebJobsStorage', azuriteConnectionString)
    .withEnvironment('ConnectionStrings__Storage', azuriteConnectionString)
    .withEnvironment('INTERNAL_WEBHOOK_SECRET', internalWebhookSecret);

const functions = builder
    .addExecutable(
        'functions',
        'npx',
        'apps/functions',
        ['--yes', 'func', 'start', '--port', '7071', '--no-build']
    )
    .waitFor(azurite)
    .waitFor(api)
    .withHttpEndpoint({ port: 7071, targetPort: 7071, name: 'http', isProxied: false })
    .withEnvironment('AzureWebJobsStorage', azuriteConnectionString)
    .withEnvironment('FUNCTIONS_WORKER_RUNTIME', 'node')
    .withEnvironment('API_BASE_URL', api.getEndpoint('http'))
    .withEnvironment('INTERNAL_WEBHOOK_SECRET', internalWebhookSecret)
    .withEnvironment('SMS_PROVIDER', smsProvider)
    .withEnvironment('AzureFunctionsJobHost__logging__console__isEnabled', 'true');

const web = builder
    .addExecutable(
        'web',
        'npm',
        'apps/web',
        ['start', '--', '--host', '0.0.0.0', '--port', '4200']
    )
    .waitFor(api)
    .withHttpEndpoint({ port: 4200, targetPort: 4200, name: 'ui', isProxied: false })
    .withEnvironment('API_URL', api.getEndpoint('http'));

void functions;
void web;

await builder.build().run();
