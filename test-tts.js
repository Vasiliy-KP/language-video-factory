import { EdgeTTSService } from "./src/services/speech/EdgeTTSService.js";

const tts = new EdgeTTSService();

await tts.generate(
    "Hello! This is a test of our language video factory.",
    "en",
    "./output/audio/test-edge-tts.mp3"
);

console.log("TTS test completed!");