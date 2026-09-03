import { AudioMetadataService } from "./src/services/audio/AudioMetadataService.js";

const metadataService = new AudioMetadataService();

const files = [
    "output/audio/велосипед_uk.mp3",
    "output/audio/Bicycle_en.mp3",
    "output/audio/Vélo_fr.mp3",
    "output/audio/Fahrrad_de.mp3",
];

for (const file of files) {
    const duration =
        await metadataService.getDuration(file);

    console.log(
        `${file} → ${duration.toFixed(3)} s`
    );
}