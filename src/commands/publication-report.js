import {
    PublicationReportService,
} from "../services/PublicationReportService.js";

const PLATFORM_LABELS = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtubeShorts: "YouTube Shorts",
};

async function main() {
    const report = await PublicationReportService.build();

    console.log("\n## Publication report");
    console.log(`Generated at: ${report.generatedAt}`);

    console.log("\n## Overall progress");
    console.log(`Words: ${report.summary.words}`);
    console.log(`Platform publications: ${report.summary.totalPlatforms}`);
    console.log(`Published: ${report.summary.published}`);
    console.log(`Pending: ${report.summary.pending}`);
    console.log(`Progress: ${report.summary.progressPercent}%`);
    console.log(`Excluded packages: ${report.summary.excludedPackages}`);

    if (report.items.length === 0) {
        console.log("\nNo eligible packages to report.");
    }

    for (const item of report.items) {
        console.log(
            `\n## ${item.word} — ${item.summary.published}/${item.summary.total} published (${item.summary.progressPercent}%)`
        );

        for (const platform of item.platforms) {
            const label =
                PLATFORM_LABELS[platform.platform] ?? platform.platform;

            const icon =
                platform.status === "published" ? "✅" : "⏳";

            console.log(`\n${icon} ${label}: ${platform.status}`);

            if (platform.status === "published") {
                console.log(`   Published at: ${platform.publishedAt}`);
                console.log(`   URL: ${platform.url}`);
            }
        }
    }

    if (report.excluded.length > 0) {
        console.log("\n## Excluded packages");

        for (const item of report.excluded) {
            console.log(`\n⚠️ ${item.word} — ${item.status}`);

            for (const error of item.errors ?? []) {
                console.log(
                    `   ❌ ${error.message ?? error.code ?? "Unknown error"}`
                );
            }

            for (const error of item.platformErrors ?? []) {
                console.log(
                    `   ❌ ${error.platform}: ${error.message}`
                );
            }
        }
    }
}

main().catch((error) => {
    console.error(`❌ Publication report failed: ${error.message}`);
    process.exitCode = 1;
});