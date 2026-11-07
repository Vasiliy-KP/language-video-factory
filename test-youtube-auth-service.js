
import assert from "node:assert/strict";
import {
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    YouTubeAuthService,
} from "./src/services/YouTubeAuthService.js";

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "youtube-auth-test-")
    );

    try {
        console.log("▶ Testing YouTubeAuthService...");

        assert.throws(
            () => YouTubeAuthService.getConfig({}),
            /YOUTUBE_CLIENT_ID is missing/
        );

        console.log("✅ Missing OAuth configuration is detected");

        const tokenPath = path.join(
            tempRoot,
            "secrets",
            "youtube-token.json"
        );

        const env = {
            YOUTUBE_CLIENT_ID: "test-client-id",
            YOUTUBE_CLIENT_SECRET: "test-client-secret",
            YOUTUBE_TOKEN_PATH: tokenPath,
        };

        const config = YouTubeAuthService.getConfig(env);

        assert.equal(
            config.tokenPath,
            path.resolve(tokenPath)
        );

        console.log("✅ OAuth configuration is loaded");

        const missingTokens =
            await YouTubeAuthService.loadTokenData({
                tokenPath,
            });

        assert.equal(missingTokens, null);

        console.log("✅ Missing token file is handled");

        await assert.rejects(
            YouTubeAuthService.saveTokenData({
                tokenPath,
                tokens: {
                    access_token: "test-access-token",
                },
            }),
            /without a refresh token/
        );

        console.log("✅ Tokens without refresh token are rejected");

        const testTokens = {
            access_token: "test-access-token",
            refresh_token: "test-refresh-token",
            token_type: "Bearer",
            expiry_date: 1790000000000,
        };

        await YouTubeAuthService.saveTokenData({
            tokenPath,
            tokens: testTokens,
        });

        const savedData =
            await YouTubeAuthService.loadTokenData({
                tokenPath,
            });

        assert.deepEqual(savedData.tokens, testTokens);
        assert.equal(savedData.schemaVersion, 1);

        console.log("✅ Tokens are saved and loaded");

        const authClient =
            await YouTubeAuthService.getAuthenticatedClient({
                env,
            });

        assert.equal(
            authClient.credentials.refresh_token,
            "test-refresh-token"
        );

        console.log("✅ Authenticated OAuth client is created");

        const savedFile = JSON.parse(
            await readFile(tokenPath, "utf8")
        );

        assert.equal(savedFile.schemaVersion, 1);
        assert.ok(savedFile.savedAt);

        console.log("✅ Token file structure is valid");

        const invalidTokenPath = path.join(
            tempRoot,
            "invalid-token.json"
        );

        await writeFile(
            invalidTokenPath,
            "{ invalid json",
            "utf8"
        );

        await assert.rejects(
            YouTubeAuthService.loadTokenData({
                tokenPath: invalidTokenPath,
            }),
            /invalid JSON/
        );

        console.log("✅ Invalid token JSON is detected");

        console.log("\n✅ All YouTube auth service tests passed");
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
