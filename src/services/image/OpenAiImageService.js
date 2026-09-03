import OpenAI from "openai";
import fs from "fs/promises";

export class OpenAIImageService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error(
                "OPENAI_API_KEY is not defined in .env"
            );
        }

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async generate(prompt, outputPath) {
        console.log(`Generating image: ${prompt}`);

        const result = await this.client.images.generate({
            model: "gpt-image-1",
            prompt,
            size: "1024x1024"
        });

        const imageBase64 = result.data?.[0]?.b64_json;

        if (!imageBase64) {
            throw new Error(
                "Image API did not return image data"
            );
        }

        const imageBuffer =
            Buffer.from(imageBase64, "base64");

        await fs.writeFile(
            outputPath,
            imageBuffer
        );

        console.log(
            `Image saved: ${outputPath}`
        );

        return outputPath;
    }
}