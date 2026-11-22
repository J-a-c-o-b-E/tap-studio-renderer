// Pre-bundles the Remotion project into build/ so renders start fast (used by the Docker image).
import { bundleProject } from "../lib/pipeline.mjs";

const dir = await bundleProject({ force: true });
console.log(`bundle written to ${dir}`);
