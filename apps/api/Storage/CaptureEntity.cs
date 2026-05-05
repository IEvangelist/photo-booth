using Azure;
using Azure.Data.Tables;

namespace PhotoBooth.Api.Storage;

public sealed class CaptureEntity : ITableEntity
{
    public string PartitionKey { get; set; } = "captures";
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string State { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int FrameCount { get; set; }
    public string? ShareUrl { get; set; }
    public string? Error { get; set; }
    public string? ProviderMessageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? StitchedAt { get; set; }
    public DateTimeOffset? SmsSentAt { get; set; }
}
