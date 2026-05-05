using Azure.Data.Tables;
using Azure.Storage.Blobs;
using Azure.Storage.Queues;
using PhotoBooth.Api.Configuration;
using PhotoBooth.Api.Endpoints;
using PhotoBooth.Api.Hubs;
using PhotoBooth.Api.Storage;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──────────────────────────────────────────────────────────
builder.Services.AddOptions<BoothOptions>()
    .Bind(builder.Configuration.GetSection("Booth"))
    .ValidateDataAnnotations();

builder.Services.AddSingleton(sp => sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<BoothOptions>>().Value);

// ── Storage clients (Azurite-backed via env) ───────────────────────────────
var storageConn = builder.Configuration["AzureWebJobsStorage"]
                  ?? builder.Configuration.GetConnectionString("Storage")
                  ?? "UseDevelopmentStorage=true";

builder.Services.AddSingleton(_ => new BlobServiceClient(storageConn));
builder.Services.AddSingleton(_ => new QueueServiceClient(storageConn));
builder.Services.AddSingleton(_ => new TableServiceClient(storageConn));
builder.Services.AddSingleton<CaptureRepository>();
builder.Services.AddSingleton<ICaptureSnapshotProvider>(sp => sp.GetRequiredService<CaptureRepository>());
builder.Services.AddHostedService<StorageBootstrapper>();

// ── Web framework features ─────────────────────────────────────────────────
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// Frame payloads can be a few MB. Bump the limit.
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(o =>
    o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.MaxRequestBodySize = 32 * 1024 * 1024;
});

// ── Internal webhook secret ────────────────────────────────────────────────
var internalSecret = builder.Configuration["INTERNAL_WEBHOOK_SECRET"]
                     ?? throw new InvalidOperationException("INTERNAL_WEBHOOK_SECRET is required");

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

app.MapGet("/", () => Results.Redirect("/openapi/v1.json"));
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.MapCaptureEndpoints();
app.MapInternalEndpoints(internalSecret);

app.MapHub<StatusHub>("/hubs/status");

app.Run();

public partial class Program;
