namespace PhotoBooth.Api.Configuration;

public sealed class BoothOptions
{
    public int PhotosToTake { get; set; } = 3;
    public int PhotoCountDownDefault { get; set; } = 3;
    public int IntervalBetweenCountDown { get; set; } = 777;
    public int FrameDelay { get; set; } = 333;
    public int ImageWidth { get; set; } = 640;
    public int ImageHeight { get; set; } = 480;

    public string RawContainer { get; set; } = "photoboothraw";
    public string ShareContainer { get; set; } = "photoboothshare";
    public string CapturesTable { get; set; } = "captures";
    public string StitchQueue { get; set; } = "stitch-requests";
    public string SmsQueue { get; set; } = "sms-requests";
}
