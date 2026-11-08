
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
    mkdir,
    readFile,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

import { google } from "googleapis";
import open from "open";

const SCHEMA_VERSION = 1;

const YOUTUBE_UPLOAD_SCOPE =
    "https://www.googleapis.com/auth/youtube.upload";

const YOUTUBE_READONLY_SCOPE =
    "https://www.googleapis.com/auth/youtube.readonly";

const YOUTUBE_SCOPES = [
    YOUTUBE_UPLOAD_SCOPE,
    YOUTUBE_READONLY_SCOPE,
];

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

export class YouTubeAuthService {
    static getConfig(env = process.env) {
        const clientId = env.YOUTUBE_CLIENT_ID?.trim();
        const clientSecret = env.YOUTUBE_CLIENT_SECRET?.trim();

        if (
            !clientId ||
            clientId === "your_google_oauth_client_id"
        ) {
            throw new Error(
                "YOUTUBE_CLIENT_ID is missing. Check your .env file."
            );
        }

        if (
            !clientSecret ||
            clientSecret === "your_google_oauth_client_secret"
        ) {
            throw new Error(
                "YOUTUBE_CLIENT_SECRET is missing. Check your .env file."
            );
        }

        const tokenPath =
            env.YOUTUBE_TOKEN_PATH?.trim() ||
            "output/secrets/youtube-token.json";

        return {
            clientId,
            clientSecret,
            tokenPath: path.resolve(tokenPath),
        };
    }

    static createOAuthClient({
        clientId,
        clientSecret,
        redirectUri,
    }) {
        return new google.auth.OAuth2({
            clientId,
            clientSecret,
            redirectUri,
        });
    }

    static async loadTokenData({ tokenPath }) {
        let contents;

        try {
            contents = await readFile(tokenPath, "utf8");
        } catch (error) {
            if (error.code === "ENOENT") {
                return null;
            }

            throw error;
        }

        let data;

        try {
            data = JSON.parse(contents);
        } catch {
            throw new Error(
                `YouTube token file contains invalid JSON: ${tokenPath}`
            );
        }

        if (
            data?.schemaVersion !== SCHEMA_VERSION ||
            !data.tokens ||
            typeof data.tokens.refresh_token !== "string" ||
            !data.tokens.refresh_token
        ) {
            throw new Error(
                "YouTube token file has an unsupported or invalid structure."
            );
        }

        return data;
    }

    static async saveTokenData({
        tokenPath,
        tokens,
        scopes = YOUTUBE_SCOPES,
    }) {
        if (
            !tokens ||
            typeof tokens.refresh_token !== "string" ||
            !tokens.refresh_token
        ) {
            throw new Error(
                "Cannot save YouTube tokens without a refresh token."
            );
        }

        const filePath = path.resolve(tokenPath);

        const data = {
            schemaVersion: SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            scopes,
            tokens,
        };

        await mkdir(path.dirname(filePath), {
            recursive: true,
            mode: 0o700,
        });

        await writeFile(
            filePath,
            `${JSON.stringify(data, null, 2)}\n`,
            {
                encoding: "utf8",
                mode: 0o600,
            }
        );

        return filePath;
    }

    static async getAuthenticatedClient({
        env = process.env,
    } = {}) {
        const config = this.getConfig(env);

        const tokenData = await this.loadTokenData({
            tokenPath: config.tokenPath,
        });

        if (!tokenData) {
            throw new Error(
                'YouTube is not authorized. Run "npm run youtube:auth" first.'
            );
        }

        const oauthClient = this.createOAuthClient({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
        });

        oauthClient.setCredentials(tokenData.tokens);

        // Зберігаємо оновлені токени після автоматичного refresh.
        oauthClient.on("tokens", (updatedTokens) => {
            const mergedTokens = {
                ...tokenData.tokens,
                ...updatedTokens,
            };

            tokenData.tokens = mergedTokens;

            this.saveTokenData({
                tokenPath: config.tokenPath,
                tokens: mergedTokens,
                scopes: tokenData.scopes,
            }).catch((error) => {
                console.error(
                    `Could not save refreshed YouTube tokens: ${error.message}`
                );
            });
        });

        return oauthClient;
    }

    static async authorize({
        env = process.env,
        openBrowser = open,
    } = {}) {
        const config = this.getConfig(env);

        const server = createServer();
        let timeoutId;

        let resolveCallback;
        let rejectCallback;

        const callbackPromise = new Promise((resolve, reject) => {
            resolveCallback = resolve;
            rejectCallback = reject;
        });

        let callbackHandled = false;
        let state = null;

        server.on("request", (request, response) => {
            if (request.method !== "GET") {
                response.writeHead(405);
                response.end("Method not allowed.");
                return;
            }

            const callbackUrl = new URL(
                request.url ?? "/",
                "http://127.0.0.1"
            );

            if (callbackUrl.pathname !== "/") {
                response.writeHead(404);
                response.end("Not found.");
                return;
            }

            if (callbackHandled) {
                response.writeHead(409);
                response.end("Authorization response already received.");
                return;
            }

            const error = callbackUrl.searchParams.get("error");

            if (error) {
                callbackHandled = true;

                response.writeHead(400, {
                    "Content-Type": "text/html; charset=utf-8",
                });
                response.end(
                    "<h2>YouTube authorization was not completed. Return to the terminal.</h2>"
                );

                rejectCallback(
                    new Error(`Google authorization failed: ${error}`)
                );
                return;
            }

            const receivedState =
                callbackUrl.searchParams.get("state") ?? "";

            const stateMatches = (() => {
                const expected = Buffer.from(state);
                const received = Buffer.from(receivedState);

                return (
                    expected.length === received.length &&
                    timingSafeEqual(expected, received)
                );
            })();

            if (!stateMatches) {
                callbackHandled = true;

                response.writeHead(400);
                response.end("Invalid OAuth state.");

                rejectCallback(
                    new Error("OAuth state validation failed.")
                );
                return;
            }

            const code = callbackUrl.searchParams.get("code");

            if (!code) {
                callbackHandled = true;

                response.writeHead(400);
                response.end("Authorization code is missing.");

                rejectCallback(
                    new Error("Google did not return an authorization code.")
                );
                return;
            }

            callbackHandled = true;

            response.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            });

            response.end(`
                <!doctype html>
                <html lang="en">
                    <head>
                        <meta charset="utf-8">
                        <title>YouTube authorization</title>
                    </head>
                    <body>
                        <h2>YouTube authorization completed.</h2>
                        <p>You can close this browser tab and return to the terminal.</p>
                    </body>
                </html>
            `);

            resolveCallback({ code });
        });

        try {
            await new Promise((resolve, reject) => {
                server.once("error", reject);

                server.listen(0, "127.0.0.1", resolve);
            });

            const address = server.address();

            if (!address || typeof address === "string") {
                throw new Error(
                    "Could not determine the local OAuth server port."
                );
            }

            const redirectUri = `http://127.0.0.1:${address.port}`;

            const oauthClient = this.createOAuthClient({
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                redirectUri,
            });

            // PKCE: окремий verifier і challenge для кожної авторизації.
            const {
                codeVerifier,
                codeChallenge,
            } = await oauthClient.generateCodeVerifierAsync();

            state = randomBytes(32).toString("hex");

            const authorizationUrl = oauthClient.generateAuthUrl({
                access_type: "offline",
                include_granted_scopes: true,
                prompt: "consent",
                scope: YOUTUBE_SCOPES,
                state,
                code_challenge: codeChallenge,
                code_challenge_method: "S256",
            });

            timeoutId = setTimeout(() => {
                rejectCallback(
                    new Error(
                        "YouTube authorization timed out after 5 minutes."
                    )
                );
            }, AUTH_TIMEOUT_MS);

            try {
                await openBrowser(authorizationUrl);
                console.log("🌐 Google authorization page opened.");
            } catch {
                console.log(
                    "\nCould not open the browser automatically."
                );
                console.log(
                    "Open this authorization URL manually:\n"
                );
                console.log(authorizationUrl);
            }

            console.log(
                "Waiting for Google authorization callback..."
            );

            const { code } = await callbackPromise;

            const { tokens } = await oauthClient.getToken({
                code,
                codeVerifier,
            });

            // Під час повторної авторизації Google може не повертати
            // refresh_token. У такому разі зберігаємо попередній.
            const previousData = await this.loadTokenData({
                tokenPath: config.tokenPath,
            });

            const previousScopes = Array.isArray(previousData?.scopes)
                ? previousData.scopes
                : typeof previousData?.tokens?.scope === "string"
                    ? previousData.tokens.scope.split(/\s+/).filter(Boolean)
                    : [];

            const grantedScopes =
                typeof tokens.scope === "string"
                    ? tokens.scope.split(/\s+/).filter(Boolean)
                    : [
                        ...new Set([
                            ...previousScopes,
                            ...YOUTUBE_SCOPES,
                        ]),
                    ];

            const missingScopes = YOUTUBE_SCOPES.filter(
                (scope) => !grantedScopes.includes(scope)
            );

            if (missingScopes.length > 0) {
                throw new Error(
                    "Google did not grant all required YouTube permissions: " +
                    missingScopes.join(", ") +
                    '. Run "npm run youtube:auth" again and grant both permissions.'
                );
            }

            const mergedTokens = {
                ...(previousData?.tokens ?? {}),
                ...tokens,
                scope: grantedScopes.join(" "),
            };

            if (!mergedTokens.refresh_token) {
                throw new Error(
                    "Google did not return a refresh token. " +
                    "Revoke the previous app access in your Google Account " +
                    "and run authorization again."
                );
            }

            const savedPath = await this.saveTokenData({
                tokenPath: config.tokenPath,
                tokens: mergedTokens,
                scopes: grantedScopes,
            });

            return {
                authorized: true,
                tokenPath: savedPath,
                scopes: grantedScopes,
            };
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (server.listening) {
                await new Promise((resolve) => {
                    server.close(resolve);
                });
            }
        }
    }
}
