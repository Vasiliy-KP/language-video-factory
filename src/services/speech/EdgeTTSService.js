import { SpeechService } from "./SpeechService.js";

export class EdgeTTSService extends SpeechService {
    async generate(text, language, outputPath) {
        console.log(`Generate "${text}" (${language}) -> ${outputPath}`);
    }
}