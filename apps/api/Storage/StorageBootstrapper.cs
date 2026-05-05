using Azure.Data.Tables;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Queues;
using PhotoBooth.Api.Configuration;

namespace PhotoBooth.Api.Storage;

public sealed class StorageBootstrapper(
    BlobServiceClient blobs,
    QueueServiceClient queues,
    TableServiceClient tables,
    BoothOptions options,
    ILogger<StorageBootstrapper> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Bootstrapping Azurite containers, queues, and tables.");

        var raw = blobs.GetBlobContainerClient(options.RawContainer);
        await raw.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);

        var share = blobs.GetBlobContainerClient(options.ShareContainer);
        await share.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: cancellationToken);

        await queues.GetQueueClient(options.StitchQueue).CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        await queues.GetQueueClient(options.SmsQueue).CreateIfNotExistsAsync(cancellationToken: cancellationToken);

        await tables.GetTableClient(options.CapturesTable).CreateIfNotExistsAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
