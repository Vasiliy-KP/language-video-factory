import { execFile } from "child_process";
import { promisify } from "util";

import { SpeechService } from "./SpeechService.js";
import { FileSystem } from "../../utils/FileSystem.js";
import { voices } from "./VoiceConfig.js";

const execFileAsync = promisify(execFile);

export class EdgeTTSService extends SpeechService {
    async generate(text, language, outputPath) {
        await FileSystem.ensureDirectory(outputPath);

        const voice = this.getVoice(language);

        await execFileAsync("python", [
            "-m",
            "edge_tts",
            "--text",
            text,
            "--voice",
            voice,
            "--write-media",
            outputPath,
        ]);

        return outputPath;
    }

    getVoice(language) {
        if (!voices[language]) {
            throw new Error(`Unsupported TTS language: ${language}`);
        }

        return voices[language];
    }
}