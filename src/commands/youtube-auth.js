
import "dotenv/config";

import {
    YouTubeAuthService,
} from "../services/YouTubeAuthService.js";

async function main() {
    console.log("\n## YouTube authorization");
    console.log("Starting OAuth 2.0 authorization...");

    const result = await YouTubeAuthService.authorize();

    console.log("\n✅ YouTube authorization completed.");
    console.log(`Token file: ${result.tokenPath}`);
    console.log(`Granted scopes: ${result.scopes.join(", ")}`);
    console.log("\nYou can now use the saved authorization.");
}

main().catch((error) => {
    console.error(`\n❌ YouTube authorization failed: ${error.message}`);
    process.exitCode = 1;
});
