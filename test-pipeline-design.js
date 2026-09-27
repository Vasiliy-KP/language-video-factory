import { config } from "./src/config/config.js";
import { videoDesign } from "./src/config/videoDesign.js";

const designName = config.video.design;

console.log(
    `▶ Pipeline video design: ${designName}`
);

if (!videoDesign[designName]) {
    throw new Error(
        `Configured video design does not exist: ${designName}`
    );
}

console.log(
    `✅ Design "${designName}" is configured correctly`
);