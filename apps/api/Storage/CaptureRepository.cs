using Azure;
using Azure.Data.Tables;
using PhotoBooth.Api.Configuration;
using PhotoBooth.Api.Hubs;
using PhotoBooth.Api.Models;

namespace PhotoBooth.Api.Storage;

public sealed class CaptureRepository(
    TableServiceClient tables,
    BoothOptions options,
    ILogger<CaptureRepository> logger) : ICaptureSnapshotProvider
{
    private TableClient Table => tables.GetTableClient(options.CapturesTable);

    public async Task CreateAsync(string captureId, string phone, int frameCount, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var entity = new CaptureEntity
        {
            RowKey = captureId,
            State = CaptureStates.Queued,
            Phone = phone,
            FrameCount = frameCount,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await Table.AddEntityAsync(entity, ct);
    }

    public async Task<CaptureStatusResponse?> TryGetAsync(string captureId, CancellationToken ct = default)
    {
        try
        {
            var response = await Table.GetEntityAsync<CaptureEntity>("captures", captureId, cancellationToken: ct);
            var e = response.Value;
            return new CaptureStatusResponse(e.RowKey, e.State, e.ShareUrl, e.LandingUrl, e.Error, e.CreatedAt, e.UpdatedAt);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    /// <summary>
    /// Returns the most recent successfully-stitched captures (uploaded or sent), newest first,
    /// for the kiosk's idle gallery carousel. Capped at <paramref name="limit"/> items.
    /// </summary>
    public async Task<IReadOnlyList<GalleryItem>> GetRecentSentAsync(int limit, CancellationToken ct = default)
    {
        if (limit <= 0) return Array.Empty<GalleryItem>();

        var items = new List<CaptureEntity>(capacity: limit);
        var filter = $"PartitionKey eq 'captures' and ShareUrl ne ''";
        await foreach (var page in Table.QueryAsync<CaptureEntity>(filter, cancellationToken: ct).AsPages())
        {
            foreach (var entity in page.Values)
            {
                if (string.IsNullOrEmpty(entity.ShareUrl)) continue;
                if (entity.State == CaptureStates.StitchFailed) continue;
                items.Add(entity);
            }
        }

        return items
            .OrderByDescending(e => e.UpdatedAt)
            .Take(limit)
            .Select(e => new GalleryItem(
                e.RowKey,
                e.ShareUrl ?? string.Empty,
                e.LandingUrl ?? string.Empty,
                e.CreatedAt))
            .ToList();
    }

    /// <summary>
    /// Advance state with optimistic concurrency. Idempotent: if the desired state has already
    /// been reached or surpassed, this is a no-op and returns the current row.
    /// </summary>
    public async Task<CaptureEntity?> AdvanceStateAsync(
        string captureId,
        string newState,
        Action<CaptureEntity>? mutate = null,
        CancellationToken ct = default)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            CaptureEntity entity;
            try
            {
                var response = await Table.GetEntityAsync<CaptureEntity>("captures", captureId, cancellationToken: ct);
                entity = response.Value;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                logger.LogWarning("AdvanceStateAsync: capture {CaptureId} not found", captureId);
                return null;
            }

            if (IsTerminalOrPastState(entity.State, newState))
            {
                return entity;
            }

            entity.State = newState;
            entity.UpdatedAt = DateTimeOffset.UtcNow;
            mutate?.Invoke(entity);

            try
            {
                await Table.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace, ct);
                return entity;
            }
            catch (RequestFailedException ex) when (ex.Status == 412)
            {
                // ETag mismatch — somebody else advanced it. Re-read and retry.
                continue;
            }
        }

        logger.LogWarning("AdvanceStateAsync: gave up on {CaptureId} → {State}", captureId, newState);
        return null;
    }

    private static readonly Dictionary<string, int> Order = new(StringComparer.OrdinalIgnoreCase)
    {
        [CaptureStates.Queued] = 0,
        [CaptureStates.Stitching] = 1,
        [CaptureStates.Uploaded] = 2,
        [CaptureStates.Sending] = 3,
        [CaptureStates.Sent] = 4,
        [CaptureStates.SmsFailed] = 4,
        [CaptureStates.StitchFailed] = 4,
    };

    private static bool IsTerminalOrPastState(string current, string desired)
    {
        if (!Order.TryGetValue(current, out var c) || !Order.TryGetValue(desired, out var d))
        {
            return false;
        }

        return c >= d;
    }
}
