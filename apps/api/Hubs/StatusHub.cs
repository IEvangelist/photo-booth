using Microsoft.AspNetCore.SignalR;
using PhotoBooth.Api.Models;

namespace PhotoBooth.Api.Hubs;

public sealed class StatusHub(ICaptureSnapshotProvider snapshots) : Hub
{
    public async Task JoinCapture(string captureId)
    {
        if (string.IsNullOrWhiteSpace(captureId))
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, captureId);

        // Always send a snapshot first — defends against the kiosk joining
        // *after* a queue trigger has already advanced the state.
        var snapshot = await snapshots.TryGetAsync(captureId);
        if (snapshot is not null)
        {
            await Clients.Caller.SendAsync("status", snapshot);
        }
    }

    public Task LeaveCapture(string captureId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, captureId);
}

public interface ICaptureSnapshotProvider
{
    Task<CaptureStatusResponse?> TryGetAsync(string captureId, CancellationToken cancellationToken = default);
}
