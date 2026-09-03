import fs from "fs/promises";
import path from "path";

export class CloudflareImageService {
    constructor() {
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        this.apiToken = process.env.CLOUDFLARE_API_TOKEN;

        this.model = "@cf/black-forest-labs/flux-1-schnell";

        if (!this.accountId) {
            throw new Error(
                "CLOUDFLARE_ACCOUNT_ID is not defined in .env"
            );
        }

        if (!this.apiToken) {
            throw new Error(
                "CLOUDFLARE_API_TOKEN is not defined in .env"
            );
        }
    }

    async generate(prompt, outputPath) {
        console.log(`Generating image: ${prompt}`);

        const url =
            `https://api.cloudflare.com/client/v4/accounts/` +
            `${this.accountId}/ai/run/${this.model}`;

        const response = await fetch(url, {
            method: "POST",

            headers: {
                Authorization: `Bearer ${this.apiToken}`,
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                prompt,
                steps: 4,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(
                `Cloudflare API error ${response.status}: ${errorText}`
            );
        }

        const data = await response.json();

        if (!data.success || !data.result?.image) {
            throw new Error(
                `Unexpected Cloudflare response: ${JSON.stringify(data)}`
            );
        }

        const imageBuffer = Buffer.from(
            data.result.image,
            "base64"
        );

        await fs.mkdir(path.dirname(outputPath), {
            recursive: true,
        });

        await fs.writeFile(outputPath, imageBuffer);

        return outputPath;
    }
}