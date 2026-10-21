
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    PublishingMetadataService,
} from "./src/services/PublishingMetadataService.js";

import {
    PublishingMetadataWriter,
} from "./src/services/PublishingMetadataWriter.js";

const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "language-video-factory-")
);

try {
    const word = {
        category: "Transport",
        level: "A1",
        uk: "велосипед",
        en: "Bicycle",
        pl: "Rower",
        fr: "Vélo",
        de: "Fahrrad",
        es: "Bicicleta",
    };

    const metadata = PublishingMetadataService.create(word);

    const filePath = await PublishingMetadataWriter.save(
        metadata,
        tempDirectory
    );

    const savedContent = await readFile(filePath, "utf8");
    const savedMetadata = JSON.parse(savedContent);

    assert.equal(savedMetadata.word, "Bicycle");
    assert.equal(savedMetadata.translations.length, 6);
    assert.ok(savedMetadata.platforms.tiktok);
    assert.ok(savedMetadata.platforms.instagram);
    assert.ok(savedMetadata.platforms.youtubeShorts);

    await assert.rejects(
        () => PublishingMetadataWriter.save(
            { word: "" },
            tempDirectory
        ),
        /word/
    );

    console.log("✅ Publishing metadata writer tests passed.");
} finally {
    await rm(tempDirectory, {
        recursive: true,
        force: true,
    });
}
