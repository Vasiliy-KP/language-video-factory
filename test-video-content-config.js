import { videoContent } from "./src/config/videoContent.js";
import { VideoTemplateService } from "./src/services/video/VideoTemplateService.js";

const templateService =
    new VideoTemplateService();

console.log(
    "▶ Testing video content configuration...\n"
);

for (const contentName of Object.keys(videoContent)) {
    const template =
        templateService.getWordTemplate(
            5,
            "default",
            contentName
        );

    console.log(
        `Content profile: ${contentName}`
    );

    console.log(
        `  title: ${template.content.title.text
        }`
    );

    console.log(
        `  title enabled: ${template.content.title.enabled
        }`
    );

    console.log(
        `  main word: ${template.content.mainWord.source
        }`
    );

    console.log(
        `  show flag: ${template.content.activeTranslation.showFlag
        }`
    );

    console.log(
        `  show language label: ${template.content.activeTranslation.showLanguageLabel
        }`
    );

    console.log(
        `  show category: ${template.content.footer.showCategory
        }`
    );

    console.log(
        `  show level: ${template.content.footer.showLevel
        }`
    );

    console.log("");
}

console.log(
    "✅ Video content configuration test completed"
);