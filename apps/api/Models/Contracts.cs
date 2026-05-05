namespace PhotoBooth.Api.Models;

public sealed record CapturePostRequest(string Phone, List<string> Frames);

public sealed record CapturePostResponse(string CaptureId);

public sealed record CaptureOptionsResponse(
    int PhotosToTake,
    int PhotoCountDownDefault,
    int IntervalBetweenCountDown,
    int FrameDelay,
    int ImageWidth,
    int ImageHeight);

public sealed record CaptureStatusResponse(
    string CaptureId,
    string State,
    string? ShareUrl,
    string? Error,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record InternalStatusUpdate(
    string CaptureId,
    string State,
    string? ShareUrl,
    string? Error,
    string? ProviderMessageId);

public sealed record StitchQueueMessage(string CaptureId);

public sealed record SmsQueueMessage(string CaptureId, string Phone, string ShareUrl);

public static class CaptureStates
{
    public const string Queued = "queued";
    public const string Stitching = "stitching";
    public const string Uploaded = "uploaded";
    public const string Sending = "sending";
    public const string Sent = "sent";
    public const string StitchFailed = "stitch_failed";
    public const string SmsFailed = "sms_failed";
}
