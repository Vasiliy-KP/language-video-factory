import path from "path";

export class OutputPathService {
    static getAudioPath(text, suffix) {
        return path.join(
            "output",
            "audio",
            `${text}_${suffix}.mp3`
        );
    }
}