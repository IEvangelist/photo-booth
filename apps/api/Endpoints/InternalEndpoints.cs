using System.Text;
using System.Text.Json;
using Azure.Storage.Queues;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using PhotoBooth.Api.Configuration;
using PhotoBooth.Api.Hubs;
using PhotoBooth.Api.Models;
using PhotoBooth.Api.Storage;

namespace PhotoBooth.Api.Endpoints;

public static class InternalEndpoints
{
    private static readonly JsonSerializerOptions QueueJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static IEndpointRouteBuilder MapInternalEndpoints(this IEndpointRouteBuilder app, string sharedSecret)
    {
        app.MapPost("/api/internal/status",
            async (HttpContext http,
                   InternalStatusUpdate update,
                   CaptureRepository repo,
                   QueueServiceClient queues,
                   IHubContext<StatusHub> hub,
                   IOptions<BoothOptions> opts,
                   ILogger<Program> logger,
                   CancellationToken ct) =>
            {
                if (!http.Request.Headers.TryGetValue("X-Internal-Auth", out var provided)
                    || !string.Equals(provided.ToString(), sharedSecret, StringComparison.Ordinal))
                {
                    return Results.Unauthorized();
                }

                var entity = await repo.AdvanceStateAsync(
                    update.CaptureId,
                    update.State,
                    e =>
                    {
                        if (!string.IsNullOrEmpty(update.ShareUrl)) e.ShareUrl = update.ShareUrl;
                        if (!string.IsNullOrEmpty(update.Error)) e.Error = update.Error;
                        if (!string.IsNullOrEmpty(update.ProviderMessageId)) e.ProviderMessageId = update.ProviderMessageId;

                        if (update.State == CaptureStates.Uploaded) e.StitchedAt = DateTimeOffset.UtcNow;
                        if (update.State == CaptureStates.Sent) e.SmsSentAt = DateTimeOffset.UtcNow;
                    },
                    ct);

                if (entity is null)
                {
                    return Results.NotFound();
                }

                if (update.State == CaptureStates.Uploaded
                    && !string.IsNullOrEmpty(entity.ShareUrl)
                    && entity.SmsSentAt is null)
                {
                    var smsQueue = queues.GetQueueClient(opts.Value.SmsQueue);
                    var msg = JsonSerializer.Serialize(new SmsQueueMessage(entity.RowKey, entity.Phone, entity.ShareUrl), QueueJson);
                    await smsQueue.SendMessageAsync(Convert.ToBase64String(Encoding.UTF8.GetBytes(msg)), ct);
                }

                var snapshot = new CaptureStatusResponse(
                    entity.RowKey, entity.State, entity.ShareUrl, entity.Error, entity.CreatedAt, entity.UpdatedAt);
                await hub.Clients.Group(entity.RowKey).SendAsync("status", snapshot, ct);

                logger.LogInformation("Capture {CaptureId} → {State}", entity.RowKey, entity.State);
                return Results.NoContent();
            });

        return app;
    }
}
