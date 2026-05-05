using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Azure.Storage.Blobs;
using Azure.Storage.Queues;
using Microsoft.Extensions.Options;
using PhotoBooth.Api.Configuration;
using PhotoBooth.Api.Models;
using PhotoBooth.Api.Storage;

namespace PhotoBooth.Api.Endpoints;

public static partial class CaptureEndpoints
{
    private const string Base64PngPrefix = "data:image/png;base64,";

    private static readonly JsonSerializerOptions QueueJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    [GeneratedRegex(@"^\+?[1-9]\d{6,14}$")]
    private static partial Regex E164Regex();

    public static IEndpointRouteBuilder MapCaptureEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/options", (IOptions<BoothOptions> opts) =>
        {
            var o = opts.Value;
            return Results.Ok(new CaptureOptionsResponse(
                o.PhotosToTake,
                o.PhotoCountDownDefault,
                o.IntervalBetweenCountDown,
                o.FrameDelay,
                o.ImageWidth,
                o.ImageHeight));
        });

        app.MapPost("/api/captures", PostCaptureAsync)
           .DisableAntiforgery();

        app.MapGet("/api/captures/{id}/status", async (string id, CaptureRepository repo, CancellationToken ct) =>
        {
            var snapshot = await repo.TryGetAsync(id, ct);
            return snapshot is null ? Results.NotFound() : Results.Ok(snapshot);
        });

        app.MapGet("/api/gallery", async (int? limit, CaptureRepository repo, CancellationToken ct) =>
        {
            var capped = Math.Clamp(limit ?? 12, 1, 48);
            var items = await repo.GetRecentSentAsync(capped, ct);
            return Results.Ok(new GalleryResponse(items));
        });

        return app;
    }

    private static async Task<IResult> PostCaptureAsync(
        CapturePostRequest request,
        BlobServiceClient blobs,
        QueueServiceClient queues,
        CaptureRepository repo,
        IOptions<BoothOptions> opts,
        ILogger<Program> logger,
        CancellationToken ct)
    {
        if (request is null || request.Frames is null || request.Frames.Count == 0)
        {
            return Results.BadRequest(new { error = "frames are required" });
        }

        var phone = (request.Phone ?? string.Empty).Trim();
        if (!E164Regex().IsMatch(phone))
        {
            return Results.BadRequest(new { error = "phone must be E.164" });
        }

        var captureId = Guid.NewGuid().ToString("n");
        var options = opts.Value;
        var rawContainer = blobs.GetBlobContainerClient(options.RawContainer);

        for (var i = 0; i < request.Frames.Count; i++)
        {
            var raw = request.Frames[i] ?? string.Empty;
            if (raw.StartsWith(Base64PngPrefix, StringComparison.Ordinal))
            {
                raw = raw[Base64PngPrefix.Length..];
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(raw);
            }
            catch (FormatException)
            {
                return Results.BadRequest(new { error = $"frame {i} is not valid base64" });
            }

            var blob = rawContainer.GetBlobClient($"{captureId}/frame-{i:000}.png");
            await blob.UploadAsync(new BinaryData(bytes), overwrite: true, cancellationToken: ct);
        }

        await repo.CreateAsync(captureId, phone, request.Frames.Count, ct);

        var queueClient = queues.GetQueueClient(options.StitchQueue);
        var payload = JsonSerializer.Serialize(new StitchQueueMessage(captureId), QueueJson);
        // Functions queueTrigger expects base64-encoded message bodies by default.
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload));
        await queueClient.SendMessageAsync(encoded, ct);

        logger.LogInformation("Queued capture {CaptureId} ({FrameCount} frames)", captureId, request.Frames.Count);

        return Results.Accepted($"/api/captures/{captureId}/status", new CapturePostResponse(captureId));
    }
}
