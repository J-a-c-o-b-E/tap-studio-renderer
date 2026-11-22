// One-time (and after every code change) setup for Remotion Lambda:
// deploys the render function and uploads the bundled site to S3, then prints the env vars to set.
// Needs AWS credentials with the Remotion Lambda policies: https://www.remotion.dev/docs/lambda/setup
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deployFunction, deploySite, getOrCreateBucket } from "@remotion/lambda";

const region = process.env.REMOTION_AWS_REGION ?? "us-east-1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { functionName } = await deployFunction({ region, timeoutInSeconds: 240, memorySizeInMb: 3008, diskSizeInMb: 4096, createCloudWatchLogGroup: true });
const { bucketName } = await getOrCreateBucket({ region });
const { serveUrl } = await deploySite({ region, bucketName, entryPoint: path.join(root, "src/index.ts"), siteName: "tap-studio-renderer", options: { publicDir: path.join(root, "public") } });

console.log(`\nSet these where the renderer runs:\n\nRENDER_MODE=lambda\nREMOTION_AWS_REGION=${region}\nREMOTION_FUNCTION_NAME=${functionName}\nREMOTION_SERVE_URL=${serveUrl}\n`);
