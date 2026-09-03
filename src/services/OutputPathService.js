import path from "path";

export class OutputPathService {
    static getAudioPath(text, suffix) {
        return path.join(
            "output",
            "audio",
            `${text}_${suffix}.mp3`
        );
    }

    static getImagePath(word) {
        return path.join(
            "output",
            "images",
            `${word}.png`
        );
    }
    static getVideoPath(word) {
        return path.join(
            "output",
            "videos",
            `${word.toLowerCase()}.mp4`
        );
    }
}