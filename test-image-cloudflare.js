import "dotenv/config";
import fs from "fs";
import path from "path";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

const prompt =
    "modern bicycle isolated on white background, clean educational illustration";

const model = "@cf/black-forest-labs/flux-1-schnell";

const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

console.log("Generating image:", prompt);

const response = await fetch(url, {
    method: "POST",

    headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
    },

    body: JSON.stringify({
        prompt,
        steps: 4,
    }),
});

if (!response.ok) {
    const errorText = await response.text();

    console.error("Cloudflare API error:");
    console.error(errorText);

    process.exit(1);
}

const data = await response.json();

if (!data.success || !data.result?.image) {
    console.error("Unexpected Cloudflare response:");
    console.error(data);

    process.exit(1);
}

const imageBuffer = Buffer.from(data.result.image, "base64");

const outputDir = path.join("output", "images");

fs.mkdirSync(outputDir, {
    recursive: true,
});

const outputPath = path.join(outputDir, "bicycle.png");

fs.writeFileSync(outputPath, imageBuffer);

console.log("Image generated successfully!");
console.log(`Saved to: ${outputPath}`);