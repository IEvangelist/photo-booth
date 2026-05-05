// Entry point — Functions v4 programming model auto-discovers files matching
// host.json `extensions.indexing` patterns. We use explicit imports so esbuild/tsc
// produce a single dist/src/index.js that pulls in all function registrations.
import "./functions/stitchGif.js";
import "./functions/dispatchSms.js";
