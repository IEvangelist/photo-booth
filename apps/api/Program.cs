using Azure.Data.Tables;
using Azure.Storage.Blobs;
using Azure.Storage.Queues;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using PhotoBooth.Api.Configuration;
using PhotoBooth.Api.Endpoints;
using PhotoBooth.Api.Hubs;
using PhotoBooth.Api.Storage;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──────────────────────────────────────────────────────────
builder.Services.AddOptions<BoothOptions>()
    .Bind(builder.Configuration.GetSection("Booth"))
    .ValidateDataAnnotations();

builder.Services.AddSingleton(sp => sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<BoothOptions>>().Value);

// ── Storage clients (Aspire-injected connection strings, one per service) ──
var blobsConn = builder.Configuration.GetConnectionString("blobs")
                ?? throw new InvalidOperationException("ConnectionStrings:blobs is required (wired by Aspire AppHost).");
var queuesConn = builder.Configuration.GetConnectionString("queues")
                 ?? throw new InvalidOperationException("ConnectionStrings:queues is required (wired by Aspire AppHost).");
var tablesConn = builder.Configuration.GetConnectionString("tables")
                 ?? throw new InvalidOperationException("ConnectionStrings:tables is required (wired by Aspire AppHost).");

builder.Services.AddSingleton(_ => new BlobServiceClient(blobsConn));
builder.Services.AddSingleton(_ => new QueueServiceClient(queuesConn));
builder.Services.AddSingleton(_ => new TableServiceClient(tablesConn));
builder.Services.AddSingleton<CaptureRepository>();
builder.Services.AddSingleton<ICaptureSnapshotProvider>(sp => sp.GetRequiredService<CaptureRepository>());
builder.Services.AddHostedService<StorageBootstrapper>();

// ── OpenTelemetry (traces + metrics + logs → Aspire dashboard via OTLP) ────
const string ServiceName = "photo-booth-api";

builder.Logging.AddOpenTelemetry(o =>
{
    o.IncludeFormattedMessage = true;
    o.IncludeScopes = true;
});

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(ServiceName))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o =>
        {
            o.Filter = ctx =>
                !ctx.Request.Path.StartsWithSegments("/healthz") &&
                !ctx.Request.Path.StartsWithSegments("/openapi") &&
                !ctx.Request.Path.StartsWithSegments("/scalar");
        })
        .AddHttpClientInstrumentation())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation());

// Hooking the OTLP exporter onto all three pipelines is auto-wired when
// `OTEL_EXPORTER_OTLP_ENDPOINT` is present (Aspire injects this for projects).
if (!string.IsNullOrEmpty(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
{
    builder.Services.Configure<OpenTelemetryLoggerOptions>(o => o.AddOtlpExporter());
    builder.Services.ConfigureOpenTelemetryTracerProvider(t => t.AddOtlpExporter());
    builder.Services.ConfigureOpenTelemetryMeterProvider(m => m.AddOtlpExporter());
}

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

app.MapOpenApi();

// Kisok-themed Scalar UI matching the gradient palette.
app.MapScalarApiReference("/scalar", opts =>
{
    opts
        .WithTitle("Photo Booth API")
        .WithTheme(ScalarTheme.Mars)
        .EnableDarkMode()
        .HideDarkModeToggle()
        .WithDefaultHttpClient(ScalarTarget.Http, ScalarClient.Http11)
        .WithCustomCss("""
            :root {
              --scalar-color-1: #f5f7fa;
              --scalar-color-2: #b6becf;
              --scalar-color-3: #6b7388;
              --scalar-color-accent: #ef476f;
              --scalar-background-1: #0b0e16;
              --scalar-background-2: #161b27;
              --scalar-background-3: #1f2433;
              --scalar-background-accent: rgba(239, 71, 111, 0.12);
              --scalar-border-color: rgba(255, 255, 255, 0.08);
              --scalar-color-green: #06d6a0;
              --scalar-color-orange: #ffd166;
              --scalar-color-red: #ef476f;
              --scalar-color-yellow: #ffd166;
              --scalar-button-1: linear-gradient(120deg, #ef476f, #ffd166);
              --scalar-button-1-color: #15101e;
              --scalar-button-1-hover: linear-gradient(120deg, #ff5c87, #ffe08a);
            }
            .dark-mode {
              --scalar-color-1: #f5f7fa;
              --scalar-color-2: #b6becf;
              --scalar-color-3: #6b7388;
              --scalar-color-accent: #ef476f;
              --scalar-background-1: #0b0e16;
              --scalar-background-2: #161b27;
              --scalar-background-3: #1f2433;
              --scalar-background-accent: rgba(239, 71, 111, 0.12);
              --scalar-border-color: rgba(255, 255, 255, 0.08);
            }
            .scalar-app .sidebar { background: linear-gradient(180deg, #0b0e16, #161b27); }
            .scalar-app .references-header h1,
            .scalar-app h1.section-title {
              background: linear-gradient(120deg, #ffd166, #ef476f, #06d6a0);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            }
            """);
});

app.UseCors();

app.MapGet("/", () => Results.Redirect("/scalar"));
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.MapCaptureEndpoints();
app.MapInternalEndpoints(internalSecret);

app.MapHub<StatusHub>("/hubs/status");

app.Run();

public partial class Program;

