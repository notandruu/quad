import { config } from "dotenv";
import { buildSponsorProofManifest } from "../src/lib/sponsors/proof";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const manifest = buildSponsorProofManifest();

console.log("quad sponsor proof");
console.log(`generated: ${manifest.generatedAt}`);
console.log(`live: ${manifest.liveCount}/${manifest.total}`);
console.log("");

console.log("demo order");
for (const step of manifest.demoRunbook.sequence) {
  const marker = step.safeToSay ? "live" : step.status;
  console.log(`- ${step.label} [${marker}]`);
  console.log(`  say: ${step.boothLine}`);
  console.log(`  show: ${step.routeOrSurface}`);
  console.log(`  check: ${step.demoMoment}`);
}

console.log("");
console.log("safe to claim");
if (manifest.safeToClaim.length === 0) {
  console.log("- no live sponsor rows in this environment");
} else {
  for (const claim of manifest.safeToClaim) console.log(`- ${claim}`);
}

console.log("");
console.log("do not claim");
if (manifest.doNotClaim.length === 0) {
  console.log("- all sponsor rows are live in this environment");
} else {
  for (const claim of manifest.doNotClaim) console.log(`- ${claim}`);
}

console.log("");
console.log("booth checklist");
for (const item of manifest.demoRunbook.boothChecklist) console.log(`- ${item}`);
