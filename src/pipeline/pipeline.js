import path from "path";

import { EdgeTTSService } from "../services/speech/EdgeTTSService.js";

export class Pipeline {

    constructor() {

        this.tts = new EdgeTTSService();

    }

    async run(words) {

        console.log("Pipeline started");

        for (const word of words) {

            await this.tts.generate(
                word.uk,
                "uk",
                path.join("output", "audio", `${word.uk}_uk.mp3`)
            );

            await this.tts.generate(
                word.en,
                "en",
                path.join("output", "audio", `${word.en}_en.mp3`)
            );

            await this.tts.generate(
                word.fr,
                "fr",
                path.join("output", "audio", `${word.fr}_fr.mp3`)
            );

            await this.tts.generate(
                word.de,
                "de",
                path.join("output", "audio", `${word.de}_de.mp3`)
            );

        }

    }

}