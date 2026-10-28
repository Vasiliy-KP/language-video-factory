
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const commandPath = path.join(
    projectRoot,
    "src",
    "commands",
    "update-publication-status.js"
);

function runCli(args, cwd) {
    const result = spawnSync(
        process.execPath,
        [commandPath, ...args],
        {
            cwd,
            encoding: "utf8",
            windowsHide: true,
        }
    );

    if (result.error) {
        throw result.error;
    }

    return {
        exitCode: result.status,
        output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    };
}

function expectFailure(args, cwd, expectedMessage) {
    const result = runCli(args, cwd);

    assert.notEqual(
        result.exitCode,
        0,
        `Expected command to fail:\n${args.join(" ")}`
    );

    assert.ok(
        result.output.includes(expectedMessage),
        `Expected error "${expectedMessage}", got:\n${result.output}`
    );
}

async function runTests() {
    const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "publication-status-cli-test-")
    );

    try {
        console.log("▶ Testing publication status CLI...");

        expectFailure(
            ["--platform=tiktok", "--status=pending"],
            tempRoot,
            "Missing required option: --word"
        );
        console.log("✅ Missing required options are rejected");

        expectFailure(
            [
                "--word=Apple",
                "--platform=tiktok",
                "--status=unknown",
            ],
            tempRoot,
            'Option --status must be "published" or "pending".'
        );
        console.log("✅ Invalid status is rejected");

        expectFailure(
            [
                "--word=Apple",
                "--platform=instagram",
                "--status=published",
            ],
            tempRoot,
            'Option --url is required when status is "published".'
        );
        console.log("✅ Published status requires a URL");

        expectFailure(
            [
                "--word=Apple",
                "--platform=instagram",
                "--status=published",
                "--url=ftp://example.com/apple",
            ],
            tempRoot,
            "Published video URL must use HTTP or HTTPS."
        );
        console.log("✅ Unsupported URL protocol is rejected");

        expectFailure(
            [
                "--word=Apple",
                "--platform=instagram",
                "--status=published",
                "--url=https://example.com/apple",
                "--published-at=not-a-date",
            ],
            tempRoot,
            "Published date must be a valid date string."
        );
        console.log("✅ Invalid publication date is rejected");

        expectFailure(
            [
                "--word=Apple",
                "--platform=unsupported",
                "--status=pending",
            ],
            tempRoot,
            "Unsupported publication platform"
        );
        console.log("✅ Unsupported platform is rejected");

        const publishResult = runCli(
            [
                "--word=Apple",
                "--platform=instagram",
                "--status=published",
                "--url=https://example.com/posts/apple",
                "--published-at=2026-10-27T18:30:00+02:00",
            ],
            tempRoot
        );

        assert.equal(
            publishResult.exitCode,
            0,
            `Publishing update failed:\n${publishResult.output}`
        );

        assert.ok(
            publishResult.output.includes("Status: published"),
            publishResult.output
        );

        const statusFile = path.join(
            tempRoot,
            "output",
            "publishing",
            "publication-status.json"
        );

        const savedData = JSON.parse(
            await readFile(statusFile, "utf8")
        );

        assert.deepEqual(savedData.items.Apple.instagram, {
            status: "published",
            publishedAt: "2026-10-27T16:30:00.000Z",
            url: "https://example.com/posts/apple",
        });

        console.log("✅ Published status, date and URL are saved");

        const resetResult = runCli(
            [
                "--word=Apple",
                "--platform=instagram",
                "--status=pending",
            ],
            tempRoot
        );

        assert.equal(
            resetResult.exitCode,
            0,
            `Reset failed:\n${resetResult.output}`
        );

        const resetData = JSON.parse(
            await readFile(statusFile, "utf8")
        );

        assert.deepEqual(resetData.items.Apple.instagram, {
            status: "pending",
            publishedAt: null,
            url: null,
        });

        console.log("✅ Pending status clears date and URL");

        console.log("\n✅ All publication status CLI tests passed");
    } finally {
        await rm(tempRoot, {
            recursive: true,
            force: true,
        });
    }
}

runTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
