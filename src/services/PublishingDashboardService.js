
import {
    mkdir,
    writeFile,
} from "node:fs/promises";

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
    PublishingPreflightService,
} from "./PublishingPreflightService.js";

const DEFAULT_OUTPUT_FILE =
    "output/publishing/dashboard.html";

function serializeReport(report) {
    // Захищаємо вбудований JSON від передчасного
    // завершення script-тега та HTML/script injection.
    return JSON.stringify(report)
        .replace(/&/g, "\\u0026")
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function createDashboardHtml(report) {
    const serializedReport = serializeReport(report);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta
        name="description"
        content="Local publishing dashboard for Language Video Factory."
    >
    <title>Publishing Dashboard | Language Video Factory</title>

    <style>
        :root {
            color-scheme: dark;
            font-family: Inter, "Segoe UI", Arial, sans-serif;
            background: #0b1020;
            color: #e5e7eb;
            --surface: #141c30;
            --surface-light: #1b2740;
            --border: #293650;
            --muted: #94a3b8;
            --blue: #60a5fa;
            --green: #34d399;
            --yellow: #fbbf24;
            --red: #fb7185;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-width: 320px;
            min-height: 100vh;
            background:
                radial-gradient(
                    ellipse at top left,
                    rgba(59, 130, 246, 0.12),
                    transparent 42%
                ),
                #0b1020;
        }

        button,
        input,
        select {
            font: inherit;
        }

        .container {
            width: min(1440px, calc(100% - 40px));
            margin: 0 auto;
            padding: 36px 0 60px;
        }

        .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 44px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .brand-mark {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 12px;
            background: #2563eb;
            color: white;
            font-size: 17px;
            font-weight: 800;
        }

        .local-label {
            color: var(--muted);
            font-size: 12px;
        }

        .hero {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 28px;
        }

        .eyebrow {
            margin: 0 0 10px;
            color: var(--blue);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0;
            font-size: clamp(30px, 5vw, 46px);
            letter-spacing: -0.045em;
        }

        .subtitle {
            margin: 12px 0 0;
            color: var(--muted);
            line-height: 1.6;
        }

        .status-badge,
        .chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            width: fit-content;
            padding: 7px 11px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface-light);
            font-size: 12px;
            font-weight: 700;
        }

        .status-ready,
        .chip-published,
        .chip-clear {
            color: var(--green);
            border-color: rgba(52, 211, 153, 0.35);
        }

        .status-warning,
        .chip-pending,
        .chip-duplicate,
        .chip-attention {
            color: var(--yellow);
            border-color: rgba(251, 191, 36, 0.35);
        }

        .status-empty,
        .chip-unknown,
        .chip-failed,
        .chip-excluded {
            color: var(--red);
            border-color: rgba(251, 113, 133, 0.35);
        }

        .metrics {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
        }

        .metric,
        .panel,
        .package-card {
            border: 1px solid var(--border);
            border-radius: 17px;
            background: rgba(20, 28, 48, 0.94);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.12);
        }

        .metric {
            min-height: 130px;
            padding: 20px;
        }

        .metric-label {
            color: var(--muted);
            font-size: 13px;
        }

        .metric-value {
            display: block;
            margin: 13px 0 5px;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .metric-detail {
            color: var(--muted);
            font-size: 12px;
        }

        .overview {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 18px;
            margin-bottom: 18px;
        }

        .panel {
            padding: 22px;
        }

        .section-title {
            margin: 0 0 18px;
            font-size: 17px;
            font-weight: 750;
        }

        .progress-track {
            overflow: hidden;
            height: 10px;
            border-radius: 999px;
            background: #26334b;
        }

        .progress-fill {
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, #3b82f6, #34d399);
            transition: width 0.25s ease;
        }

        .progress-caption {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 10px;
            color: var(--muted);
            font-size: 12px;
        }

        .platform-totals {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
            margin-top: 20px;
        }

        .youtube-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .youtube-stat {
            padding: 13px;
            border-radius: 12px;
            background: var(--surface-light);
        }

        .youtube-stat strong {
            display: block;
            margin-bottom: 5px;
            font-size: 23px;
        }

        .youtube-stat span {
            color: var(--muted);
            font-size: 12px;
        }

        .section-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin: 36px 0 16px;
        }

        .section-heading h2 {
            margin: 0;
            font-size: 21px;
        }

        .package-count {
            color: var(--muted);
            font-size: 13px;
        }

        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 16px;
        }

        .search,
        .filter-select {
            min-height: 42px;
            padding: 0 13px;
            border: 1px solid var(--border);
            border-radius: 10px;
            outline: none;
            background: var(--surface);
            color: #e5e7eb;
        }

        .search {
            flex: 1;
            min-width: 200px;
        }

        .search:focus,
        .filter-select:focus {
            border-color: var(--blue);
        }

        .package-list {
            display: grid;
            gap: 13px;
        }

        .package-card {
            padding: 20px;
        }

        .package-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 15px;
        }

        .package-title {
            margin: 0 0 6px;
            font-size: 19px;
        }

        .package-path {
            overflow-wrap: anywhere;
            color: var(--muted);
            font-size: 12px;
        }

        .platform-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-top: 15px;
        }

        .platform-card {
            min-width: 0;
            padding: 13px;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: rgba(27, 39, 64, 0.6);
        }

        .platform-name {
            display: block;
            margin-bottom: 10px;
            color: var(--muted);
            font-size: 12px;
        }

        .platform-card .chip {
            font-size: 11px;
        }

        .details {
            display: grid;
            gap: 8px;
            margin-top: 16px;
            padding-top: 15px;
            border-top: 1px solid var(--border);
        }

        .detail-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            color: var(--muted);
            font-size: 12px;
        }

        .detail-row strong {
            color: #e5e7eb;
            font-weight: 600;
        }

        .previous-upload {
            margin-top: 12px;
            padding: 14px;
            border: 1px solid rgba(251, 191, 36, 0.28);
            border-radius: 12px;
            background: rgba(120, 90, 20, 0.10);
        }

        .previous-upload h4 {
            margin: 0 0 10px;
            color: var(--yellow);
            font-size: 13px;
        }

        .error-list {
            display: grid;
            gap: 8px;
            margin: 14px 0 0;
            padding: 0;
            list-style: none;
        }

        .error-item {
            padding: 11px 13px;
            border-left: 3px solid var(--red);
            border-radius: 7px;
            background: rgba(251, 113, 133, 0.08);
            color: #fecdd3;
            font-size: 12px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .empty-state {
            padding: 35px 20px;
            border: 1px dashed var(--border);
            border-radius: 14px;
            color: var(--muted);
            text-align: center;
        }

        .issues-panel {
            margin-top: 20px;
        }

        .footer {
            margin-top: 40px;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.7;
            text-align: center;
        }

        @media (max-width: 900px) {
            .metrics {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .overview {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 600px) {
            .container {
                width: min(100% - 24px, 1440px);
                padding-top: 20px;
            }

            .topbar {
                margin-bottom: 30px;
            }

            .hero {
                align-items: flex-start;
                flex-direction: column;
            }

            .metrics {
                gap: 9px;
            }

            .metric {
                min-height: 112px;
                padding: 14px;
            }

            .metric-value {
                font-size: 27px;
            }

            .panel {
                padding: 16px;
            }

            .platform-grid {
                grid-template-columns: 1fr;
            }

            .package-card {
                padding: 15px;
            }

            .package-header {
                flex-direction: column;
            }

            .filter-select {
                width: 100%;
            }
        }

        @media print {
            body {
                background: white;
                color: #111827;
            }

            .container {
                width: 100%;
                padding: 0;
            }

            .controls {
                display: none;
            }

            .metric,
            .panel,
            .package-card {
                break-inside: avoid;
                border-color: #d1d5db;
                background: white;
                box-shadow: none;
            }

            .metric-detail,
            .metric-label,
            .package-path,
            .detail-row,
            .progress-caption {
                color: #4b5563;
            }
        }
    </style>
</head>

<body>
    <main class="container">
        <header class="topbar">
            <div class="brand">
                <span class="brand-mark">LV</span>
                <span>Language Video Factory</span>
            </div>
            <span class="local-label">LOCAL REPORT · OFFLINE READY</span>
        </header>

        <section class="hero">
            <div>
                <p class="eyebrow">Publishing overview</p>
                <h1>Publishing Dashboard</h1>
                <p class="subtitle" id="generated-at"></p>
            </div>
            <span class="status-badge" id="overall-status"></span>
        </section>

        <section class="metrics" id="metrics" aria-label="Summary metrics"></section>

        <section class="overview">
            <div class="panel">
                <h2 class="section-title">Publication progress</h2>
                <div class="progress-track">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-caption">
                    <span id="progress-label"></span>
                    <span id="progress-percent"></span>
                </div>
                <div class="platform-totals" id="platform-totals"></div>
            </div>

            <div class="panel">
                <h2 class="section-title">YouTube duplicate check</h2>
                <div class="youtube-stats" id="youtube-stats"></div>
                <p class="local-label" id="history-status"></p>
            </div>
        </section>

        <section>
            <div class="section-heading">
                <h2>Publishing packages</h2>
                <span class="package-count" id="package-count"></span>
            </div>

            <div class="controls">
                <input
                    class="search"
                    id="search"
                    type="search"
                    placeholder="Search by word or path..."
                    aria-label="Search packages"
                >

                <select
                    class="filter-select"
                    id="filter"
                    aria-label="Filter packages"
                >
                    <option value="all">All packages</option>
                    <option value="attention">Needs attention</option>
                    <option value="duplicate">YouTube duplicates</option>
                    <option value="excluded">Excluded packages</option>
                    <option value="published">Has published platforms</option>
                    <option value="pending">Has pending platforms</option>
                </select>
            </div>

            <div class="package-list" id="package-list"></div>
        </section>

        <section
            class="panel issues-panel"
            id="issues-panel"
            hidden
        >
            <h2 class="section-title">Preflight issues</h2>
            <ul class="error-list" id="issues-list"></ul>
        </section>

        <footer class="footer">
            <div>Generated by PublishingPreflightService · Language Video Factory</div>
            <div>This report is local and self-contained. No videos were uploaded and no publication statuses were changed.</div>
            <div>Use your browser's Print option to save this dashboard as PDF.</div>
        </footer>
    </main>

    <script id="dashboard-data" type="application/json">${serializedReport}</script>

    <script>
        (() => {
            "use strict";

            const report = JSON.parse(
                document.getElementById("dashboard-data").textContent
            );

            const $ = (selector) =>
                document.querySelector(selector);

            function node(tag, className = "", text = "") {
                const element = document.createElement(tag);

                if (className) {
                    element.className = className;
                }

                if (text !== undefined && text !== null) {
                    element.textContent = String(text);
                }

                return element;
            }

            function formatDate(value) {
                if (!value) {
                    return "—";
                }

                const date = new Date(value);

                if (Number.isNaN(date.getTime())) {
                    return String(value);
                }

                return new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(date);
            }

            function appendDetail(container, label, value) {
                const row = node("div", "detail-row");
                row.append(
                    node("span", "", label),
                    node("strong", "", value || "—")
                );
                container.append(row);
            }

            function addMetric(label, value, detail) {
                const card = node("article", "metric");

                card.append(
                    node("div", "metric-label", label),
                    node("strong", "metric-value", value),
                    node("div", "metric-detail", detail)
                );

                $("#metrics").append(card);
            }

            function statusClass(status) {
                const classes = {
                    ready_for_review: "status-ready",
                    needs_attention: "status-warning",
                    empty: "status-empty",
                    published: "chip-published",
                    pending: "chip-pending",
                    unknown: "chip-unknown",
                    clear: "chip-clear",
                    duplicate: "chip-duplicate",
                    check_failed: "chip-failed",
                    not_applicable: "chip-unknown",
                };

                return classes[status] || "chip-unknown";
            }

            function statusLabel(status) {
                const labels = {
                    ready_for_review: "READY FOR REVIEW",
                    needs_attention: "NEEDS ATTENTION",
                    empty: "EMPTY",
                    published: "Published",
                    pending: "Pending",
                    unknown: "Unknown",
                    clear: "No duplicate",
                    duplicate: "Duplicate detected",
                    check_failed: "Check failed",
                    not_applicable: "Not applicable",
                };

                return labels[status] || status || "Unknown";
            }

            function makeChip(label, status) {
                return node(
                    "span",
                    "chip " + statusClass(status),
                    label
                );
            }

            function renderSummary() {
                const summary = report.summary;
                const packages = summary.packages;
                const platforms = summary.platforms;
                const youtube = summary.youtube;

                $("#generated-at").textContent =
                    "Last updated: " + formatDate(report.generatedAt);

                const overall = $("#overall-status");
                overall.textContent = statusLabel(report.status);
                overall.className =
                    "status-badge " + statusClass(report.status);

                addMetric(
                    "Packages scanned",
                    packages.scanned,
                    "Packages inspected"
                );

                addMetric(
                    "Ready for review",
                    packages.eligible,
                    "Eligible publishing packages"
                );

                addMetric(
                    "Excluded",
                    packages.excluded,
                    "Packages requiring fixes"
                );

                addMetric(
                    "Published",
                    platforms.published + " / " + platforms.total,
                    platforms.pending + " pending · " +
                    platforms.unknown + " unknown"
                );

                const percent = Math.max(
                    0,
                    Math.min(100, platforms.progressPercent || 0)
                );

                $("#progress-fill").style.width = percent + "%";
                $("#progress-label").textContent =
                    platforms.published + " of " +
                    platforms.total + " platform publications";

                $("#progress-percent").textContent = percent + "%";

                $("#platform-totals").append(
                    makeChip("Published: " + platforms.published, "published"),
                    makeChip("Pending: " + platforms.pending, "pending"),
                    makeChip("Unknown: " + platforms.unknown, "unknown")
                );

                const youtubeValues = [
                    ["Checked", youtube.checked],
                    ["No duplicate", youtube.clear],
                    ["Duplicates", youtube.duplicates],
                    ["Check failed", youtube.checkFailed],
                ];

                for (const [label, value] of youtubeValues) {
                    const item = node("div", "youtube-stat");
                    item.append(
                        node("strong", "", value),
                        node("span", "", label)
                    );
                    $("#youtube-stats").append(item);
                }

                let historyLabel = "History not required";

                if (youtube.historyAvailable === true) {
                    historyLabel = "YouTube upload history: available";
                } else if (youtube.historyAvailable === false) {
                    historyLabel = "YouTube upload history: unavailable";
                }

                $("#history-status").textContent = historyLabel;
            }

            function renderPlatforms(platforms) {
                const grid = node("div", "platform-grid");

                const names = {
                    tiktok: "TikTok",
                    instagram: "Instagram",
                    youtubeShorts: "YouTube Shorts",
                };

                for (const platform of platforms || []) {
                    const card = node("div", "platform-card");

                    card.append(
                        node(
                            "span",
                            "platform-name",
                            names[platform.platform] || platform.platform
                        ),
                        makeChip(
                            statusLabel(platform.status),
                            platform.status
                        )
                    );

                    if (platform.status === "published") {
                        const details = node("div", "details");
                        appendDetail(
                            details,
                            "Published at",
                            formatDate(platform.publishedAt)
                        );
                        appendDetail(
                            details,
                            "URL",
                            platform.url
                        );
                        card.append(details);
                    }

                    grid.append(card);
                }

                return grid;
            }

            function renderPreviousUpload(previous) {
                const box = node("div", "previous-upload");

                box.append(
                    node("h4", "", "Previous YouTube upload")
                );

                const details = node("div", "details");

                appendDetail(details, "Word", previous.word);
                appendDetail(details, "Title", previous.title);
                appendDetail(details, "Video ID", previous.videoId);
                appendDetail(details, "Privacy", previous.privacyStatus);
                appendDetail(details, "Uploaded", formatDate(previous.uploadedAt));
                appendDetail(details, "URL", previous.url);

                box.append(details);
                return box;
            }

            function renderErrors(errors) {
                const list = node("ul", "error-list");

                for (const error of errors || []) {
                    const label = [
                        error.platform,
                        error.code,
                    ].filter(Boolean).join(" · ");

                    const item = node(
                        "li",
                        "error-item",
                        (label ? label + ": " : "") +
                        (error.message || "Unknown error")
                    );

                    list.append(item);
                }

                return list;
            }

            function renderPackage(entry, type) {
                const card = node("article", "package-card");

                const header = node("div", "package-header");
                const titleBlock = node("div");

                titleBlock.append(
                    node("h3", "package-title", entry.word),
                    node(
                        "div",
                        "package-path",
                        entry.packageDirectory || ""
                    )
                );

                header.append(
                    titleBlock,
                    makeChip(
                        type === "excluded"
                            ? statusLabel(entry.status)
                            : "READY FOR REVIEW",
                        type === "excluded"
                            ? "needs_attention"
                            : "ready_for_review"
                    )
                );

                card.append(header);

                if (type === "eligible") {
                    card.append(
                        renderPlatforms(entry.platforms)
                    );

                    const youtube = node("div", "details");

                    youtube.append(
                        node("strong", "", "YouTube duplicate check"),
                        makeChip(
                            statusLabel(entry.youtube.status),
                            entry.youtube.status
                        )
                    );

                    if (entry.youtube.previousUpload) {
                        youtube.append(
                            renderPreviousUpload(
                                entry.youtube.previousUpload
                            )
                        );
                    }

                    if (entry.youtube.error) {
                        youtube.append(
                            renderErrors([
                                {
                                    code: "youtube_check_failed",
                                    message: entry.youtube.error,
                                },
                            ])
                        );
                    }

                    card.append(youtube);

                    appendDetail(
                        card,
                        "Video",
                        entry.videoPath
                    );

                    appendDetail(
                        card,
                        "Metadata",
                        entry.metadataPath
                    );

                    if (entry.errors?.length) {
                        card.append(renderErrors(entry.errors));
                    }
                } else {
                    const allErrors = [
                        ...(entry.errors || []),
                        ...(entry.contentErrors || []).map((error) => ({
                            ...error,
                            code: "content · " + error.code,
                        })),
                        ...(entry.platformErrors || []),
                    ];

                    card.append(renderErrors(allErrors));
                }

                return card;
            }

            const allEntries = [
                ...(report.items || []).map((item) => ({
                    ...item,
                    kind: "eligible",
                })),
                ...(report.excluded || []).map((item) => ({
                    ...item,
                    kind: "excluded",
                })),
            ];

            function matchesFilter(entry, filter) {
                if (filter === "excluded") {
                    return entry.kind === "excluded";
                }

                if (filter === "duplicate") {
                    return entry.kind === "eligible" &&
                        entry.youtube?.status === "duplicate";
                }

                if (filter === "published") {
                    return entry.kind === "eligible" &&
                        entry.platforms?.some(
                            (platform) => platform.status === "published"
                        );
                }

                if (filter === "pending") {
                    return entry.kind === "eligible" &&
                        entry.platforms?.some(
                            (platform) => platform.status === "pending"
                        );
                }

                if (filter === "attention") {
                    return entry.kind === "excluded" ||
                        entry.errors?.length > 0 ||
                        entry.youtube?.status === "duplicate" ||
                        entry.youtube?.status === "check_failed" ||
                        entry.platforms?.some(
                            (platform) => platform.status === "unknown"
                        );
                }

                return true;
            }

            function renderPackages() {
                const search = $("#search").value
                    .trim()
                    .toLowerCase();

                const filter = $("#filter").value;

                const filtered = allEntries.filter((entry) => {
                    const searchable = [
                        entry.word,
                        entry.packageDirectory,
                        entry.videoPath,
                        entry.metadataPath,
                    ].filter(Boolean).join(" ").toLowerCase();

                    return (
                        searchable.includes(search) &&
                        matchesFilter(entry, filter)
                    );
                });

                const list = $("#package-list");
                list.replaceChildren();

                $("#package-count").textContent =
                    filtered.length + " of " + allEntries.length + " packages";

                if (filtered.length === 0) {
                    list.append(
                        node(
                            "div",
                            "empty-state",
                            "No packages match the selected search or filter."
                        )
                    );
                    return;
                }

                for (const entry of filtered) {
                    list.append(
                        renderPackage(entry, entry.kind)
                    );
                }
            }

            function renderIssues() {
                const issues = report.issues || [];

                if (issues.length === 0) {
                    $("#issues-panel").hidden = true;
                    return;
                }

                $("#issues-panel").hidden = false;

                for (const issue of issues) {
                    const word = issue.word
                        ? " [" + issue.word + "]"
                        : "";

                    $("#issues-list").append(
                        node(
                            "li",
                            "error-item",
                            issue.code + word + ": " + issue.message
                        )
                    );
                }
            }

            $("#search").addEventListener("input", renderPackages);
            $("#filter").addEventListener("change", renderPackages);

            renderSummary();
            renderPackages();
            renderIssues();
        })();
    </script>
</body>
</html>
`;
}

export class PublishingDashboardService {
    static async generate({
        projectRoot = process.cwd(),
        outputFile = DEFAULT_OUTPUT_FILE,
        preflightReport,
        preflightBuilder = (options) =>
            PublishingPreflightService.build(options),
    } = {}) {
        if (
            typeof projectRoot !== "string" ||
            !projectRoot.trim()
        ) {
            throw new Error(
                "A valid project root is required."
            );
        }

        if (
            typeof outputFile !== "string" ||
            !outputFile.trim()
        ) {
            throw new Error(
                "A valid dashboard output path is required."
            );
        }

        const root = path.resolve(projectRoot);
        const outputPath = path.resolve(root, outputFile);

        const report = preflightReport ??
            await preflightBuilder({
                projectRoot: root,
            });

        if (
            !report ||
            typeof report !== "object" ||
            !report.summary ||
            !Array.isArray(report.items) ||
            !Array.isArray(report.excluded)
        ) {
            throw new Error(
                "Publishing preflight returned an invalid report."
            );
        }

        const html = createDashboardHtml(report);

        await mkdir(path.dirname(outputPath), {
            recursive: true,
        });

        await writeFile(outputPath, html, "utf8");

        return {
            outputPath,
            relativePath: path.relative(root, outputPath),
            fileUrl: pathToFileURL(outputPath).href,
            sizeBytes: Buffer.byteLength(html, "utf8"),
            report,
        };
    }
}
