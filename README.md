# Language Video Factory

Language Video Factory is a Node.js application for generating short-form educational videos for language learning. It reads vocabulary from an Excel workbook, prepares images and speech, renders videos, and builds platform-specific publishing packages for TikTok, Instagram Reels, and YouTube Shorts.

The project also includes publishing-content validation, video/package readiness checks, a publishing queue, publication tracking, YouTube upload/history utilities, a preflight report, and a self-contained local HTML dashboard.

## Features

### Video generation

- Generates educational videos with translations and speech.
- Supports six languages: Ukrainian, English, Polish, French, German, and Spanish.
- Supports three content profiles: `default`, `simple`, and `quiz`.
- Supports two visual designs: `default` and `minimal`.
- Generates images through Cloudflare Workers AI.
- Generates speech using the Python package `edge-tts`.
- Supports selecting one or multiple words and filtering by category or CEFR level.
- Supports previewing the generation plan with `--dry-run`.
- Supports forced video regeneration with `--force`.
- Includes responsive layouts for different numbers of languages.

### Publishing workflow

- Generates publishing metadata and platform-specific text files.
- Validates translations, metadata, captions, titles, descriptions, hashtags, and generated platform text files.
- Builds publishing packages with a manifest and platform-specific text files. The manifest references the corresponding video and metadata assets.
- Checks video integrity, media properties, package files, metadata, and platform-specific readiness rules.
- Rebuilds the publishing queue using fresh readiness checks rather than trusting stale readiness reports.
- Excludes packages with blocking errors and keeps the reasons for exclusion in the queue report.
- Tracks publication status independently for TikTok, Instagram, and YouTube Shorts.
- Detects previously uploaded YouTube videos using SHA-256 file fingerprints.
- Generates a preflight report and a standalone HTML dashboard for local review.

### YouTube integration

- Supports OAuth authentication through the YouTube Data API.
- Supports uploading a selected publishing package to YouTube.
- Uses `private` privacy by default and disables subscriber notifications.
- Requires the user to type `UPLOAD` before an upload starts.
- Checks upload history for duplicate video files before upload.
- Supports `--force` to intentionally bypass duplicate protection; the `UPLOAD` confirmation is still required.
- Checks YouTube video processing status without modifying video privacy or metadata.
- Stores upload history, including the video ID, URL, privacy status, upload date, file size, and SHA-256 hash.

> **Important:** A successful private YouTube upload is not the same as publishing the video. YouTube upload history and publication tracking are separate. The publication status should be changed to `published` only after the content is actually published on the relevant platform.
>
> TikTok and Instagram publishing packages are generated and validated by this project, but this workflow does not automatically publish videos to those platforms.

## Technology stack

- Node.js and JavaScript (ES Modules)
- npm
- Python and `edge-tts`
- FFmpeg and ffprobe
- ExcelJS for reading Excel workbooks
- Cloudflare Workers AI for image generation
- Google APIs client for YouTube Data API integration
- `dotenv` for environment configuration

## Requirements

- Node.js and npm.
- Python with `pip` support.
- FFmpeg and ffprobe available through `PATH`.
- Internet access for image generation, speech synthesis, and YouTube API operations.
- Cloudflare Workers AI credentials for image generation.
- YouTube OAuth credentials for YouTube authentication and upload features.

The development environment used during project development included Node.js 24.18.0, Python 3.14, and `edge-tts` 7.3.1. Other compatible versions may work, but have not necessarily been tested.

## Installation

### 1. Get the repository

Clone the repository or open an existing local copy. Run all following commands from the project root directory, `language-video-factory`.

### 2. Install Node.js dependencies

```powershell
npm install
```

### 3. Install Python dependencies

```powershell
python -m pip install -r requirements.txt
```

The `requirements.txt` file pins `edge-tts==7.3.1`.

### 4. Verify FFmpeg

```powershell
ffmpeg -version
ffprobe -version
```

Both commands should run without errors. If either command is not found, install FFmpeg and add its `bin` directory to the system `PATH`.

### 5. Configure environment variables

Copy `.env.example` to `.env` if the local environment file does not already exist:

```powershell
Copy-Item .env.example .env
```

Configure the variables required by the services you intend to use. Image generation requires Cloudflare Workers AI credentials, including:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

YouTube commands also require valid OAuth client credentials and a valid local OAuth token created through the project's YouTube authentication flow. Follow the configuration expected by `YouTubeAuthService` and `youtube:auth`.

Never commit `.env`, API tokens, OAuth client secrets, or OAuth token files to Git. Keep local credentials private.

## Excel vocabulary workbook

The input workbook is:

```text
data/words.xlsx
```

The first worksheet must contain the following headers. Header names are case-sensitive and must match these names:

| Column | Purpose |
|---|---|
| `id` | Unique vocabulary record identifier |
| `category` | Word category, for example `Transport` |
| `uk` | Ukrainian translation |
| `en` | English translation |
| `pl` | Polish translation |
| `fr` | French translation |
| `de` | German translation |
| `es` | Spanish translation |
| `imagePrompt` | Description used to generate the image |
| `level` | CEFR level, for example `A1` |

All listed fields are required. The Excel reader validates missing, duplicate, empty, and unknown headers. Vocabulary validation checks required values, supported CEFR levels, IDs, and duplicate records.

Example records:

| id | category | uk | en | pl | fr | de | es | imagePrompt | level |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Transport | велосипед | Bicycle | Rower | Vélo | Fahrrad | Bicicleta | modern bicycle isolated on white background | A1 |
| 2 | Food | яблуко | Apple | Jabłko | Pomme | Apfel | Manzana | red apple isolated on white background | A1 |

## Video generation

### Generate videos for all valid words

```powershell
npm start
```

### Select one word

```powershell
npm start -- --word=Bicycle
```

### Select multiple words

```powershell
npm start -- --words=Bicycle,Apple
```

### Filter by category

```powershell
npm start -- --category=Transport
```

### Filter by CEFR level

```powershell
npm start -- --level=A1
```

### Combine filters

```powershell
npm start -- --category=Transport --level=A1
```

The `--words` option can be combined with category, level, content, and design options.

### Select content profile and visual design

Default profile and design:

```powershell
npm start -- --word=Bicycle --content=default --design=default
```

Simple profile with minimal design:

```powershell
npm start -- --word=Bicycle --content=simple --design=minimal
```

Quiz profile with minimal design:

```powershell
npm start -- --word=Bicycle --content=quiz --design=minimal
```

Supported content profiles: `default`, `simple`, and `quiz`.

Supported visual designs: `default` and `minimal`.

### Preview the generation plan

```powershell
npm start -- --category=Transport --content=quiz --design=minimal --dry-run
```

This reads and validates the Excel workbook, applies the selected filters, and displays the generation plan. It does not start the video pipeline.

### Force video regeneration

```powershell
npm start -- --word=Bicycle --content=quiz --design=minimal --force
```

The `--force` option regenerates the selected video even when an output video already exists. Existing images and audio can still be reused when available.

`--dry-run` and `--force` cannot be used together.

### Help

```powershell
npm start -- --help
```

Short form:

```powershell
npm start -- -h
```

## Generated video files

Main output directories:

```text
output/
├── audio/
├── images/
├── temp/
├── videos/
└── publishing/
```

Examples of generated videos:

```text
output/videos/bicycle.mp4
output/videos/bicycle-quiz-minimal.mp4
output/videos/bicycle-simple-minimal.mp4
```

The standard video mode uses a compatible filename without a mode/design suffix. Other mode/design combinations use separate output filenames.

## Publishing packages and readiness

When the pipeline generates publishing content, it creates metadata and a package for the selected word. A typical output layout is:

```text
output/
├── metadata/
│   └── Apple.json
├── videos/
│   └── apple.mp4
└── publishing/
    └── Apple/
        ├── manifest.json
        ├── readiness.json
        ├── tiktok.txt
        ├── instagram.txt
        └── youtube-shorts.txt
```

The package manifest references its video and metadata assets. Their actual paths are recorded in the manifest and may point to the shared `output/videos/` and `output/metadata/` directories. Exact filenames depend on the selected word, content profile, and design.

### Content validation

`PublishingContentValidationService` validates publishing metadata and generated platform content. Checks include:

- Required translations for all supported languages.
- Consistency between the English word and metadata.
- Required category and level information.
- Hashtag syntax and duplicates.
- Instagram hashtag count.
- TikTok and Instagram caption length.
- YouTube title and description length.
- Consistency between metadata and the platform text files.

Blocking validation errors prevent a publishing package from being treated as ready. Non-blocking warnings are reported separately.

### Video and package readiness

`PublishingReadinessService` reads each package manifest and checks the referenced video and metadata files, platform text files, media integrity, and platform-specific video requirements. It writes a `readiness.json` report in the package directory.

A `ready_for_review` status means the package passed the project's internal checks. It does not mean that a platform has approved, accepted, or published the video.

### Publishing queue

`PublishingQueueService` scans package directories under `output/publishing`, reruns readiness checks, and builds:

```text
output/publishing/queue.json
```

Packages with errors or invalid publishing content are excluded. One package's check failure does not stop the queue from processing the other packages.

## Publication tracking

Publication tracking records the actual publication status separately for each word and platform:

- `tiktok`
- `instagram`
- `youtubeShorts`

The default status is `pending`. A published status includes the publication date and URL. Tracking data is stored in:

```text
output/publishing/publication-status.json
```

### Mark a platform as published

```powershell
npm run publication:update -- --word=Apple --platform=instagram --status=published --url=https://www.instagram.com/reel/EXAMPLE/
```

An optional publication date can be supplied:

```powershell
npm run publication:update -- --word=Apple --platform=instagram --status=published --url=https://www.instagram.com/reel/EXAMPLE/ --published-at=2026-11-27T16:00:00.000Z
```

### Reset a platform to pending

```powershell
npm run publication:update -- --word=Apple --platform=instagram --status=pending
```

Supported statuses are `pending` and `published`. A valid HTTP or HTTPS URL is required when setting a platform to `published`.

### View publication progress

```powershell
npm run publication:report
```

The report displays publication counts and progress for eligible packages, along with excluded packages.

## YouTube integration

YouTube integration uses the YouTube Data API and OAuth authentication.

### Authenticate

```powershell
npm run youtube:auth
```

Complete the authentication flow and keep the generated local credentials/token files private.

### Upload a video

```powershell
npm run youtube:upload -- --word=Apple
```

The upload command:

1. Finds the selected word in the current publishing queue.
2. Reads its YouTube Shorts metadata.
3. Calculates the video SHA-256 fingerprint.
4. Checks the upload history for an identical video.
5. Displays the upload preview and settings.
6. Requires the exact confirmation `UPLOAD` before starting the upload.
7. Records the successful upload in the history file.

The upload defaults to `private` privacy and `notifySubscribers: false`. The command does not mark the platform as published. Check processing status and make the video public or publish it separately when ready.

### Intentionally bypass duplicate protection

```powershell
npm run youtube:upload -- --word=Apple --force
```

`--force` bypasses duplicate-upload protection only. It does not bypass the `UPLOAD` confirmation and does not change the default private privacy setting.

### Check video processing status

```powershell
npm run youtube:status -- --video-id=YOUTUBE_VIDEO_ID
```

This reads processing and privacy information from YouTube. It does not modify video privacy, metadata, or publication tracking.

### View upload history

```powershell
npm run youtube:history
```

Limit the number of displayed entries:

```powershell
npm run youtube:history -- --limit=10
```

Upload history is stored in:

```text
output/publishing/youtube-upload-history.json
```

The history includes video identifiers, URLs, upload dates, privacy status, video paths, file sizes, and SHA-256 fingerprints. Identical files can be detected even if they have different filenames.

## Publishing Preflight

Run the preflight check before manually publishing content:

```powershell
npm run publishing:preflight
```

The preflight process:

- Rebuilds the publishing queue using current readiness checks.
- Reads publication tracking for each eligible package.
- Counts `published`, `pending`, and `unknown` platform states.
- Loads YouTube upload history once when YouTube packages are present.
- Compares eligible YouTube videos with upload history using SHA-256.
- Reports duplicate videos and failures to read publication status, history, or video files.
- Displays excluded packages and their validation/readiness errors.

Possible overall states:

| Status | Meaning |
|---|---|
| `ready_for_review` | The current checks completed without blocking issues. Packages are ready for manual review. |
| `needs_attention` | There are excluded packages, unknown publication states, duplicate YouTube uploads, or failed checks. |
| `empty` | No publishing packages were found. |

A duplicate affects the YouTube upload workflow. It does not by itself prevent the same package from being published on TikTok or Instagram.

Preflight does not upload videos or change publication statuses. The queue and package readiness reports may be refreshed as part of the check.

## Local HTML Publishing Dashboard

Generate the dashboard:

```powershell
npm run publishing:dashboard
```

The command creates:

```text
output/publishing/dashboard.html
```

Open it in the default browser from PowerShell:

```powershell
Start-Process .\output\publishing\dashboard.html
```

The dashboard is a self-contained HTML file with embedded report data, CSS, and JavaScript. It does not require a web server, external libraries, a CDN, or an internet connection to view a generated report.

It displays:

- Overall package and publication statistics.
- Publication progress across TikTok, Instagram, and YouTube Shorts.
- YouTube duplicate-check results and previous upload details.
- Eligible and excluded publishing packages.
- Package errors and preflight issues.
- Search by word/path and filters for attention, duplicates, excluded packages, published platforms, and pending platforms.

The dashboard is a static snapshot of the latest preflight run used during generation. Run `npm run publishing:dashboard` again to refresh the HTML report after changing packages or publication statuses.

The dashboard does not upload videos or modify publication tracking. The generated file is under `output/`, which is ignored by Git.

## npm scripts

### Main application commands

| Command | Description |
|---|---|
| `npm start` | Run the video generation CLI. |
| `npm run dev` | Run the CLI with Node.js watch mode. |
| `npm run build` | Run `src/build.js`. |
| `npm run generate` | Run `src/generate.js`. |
| `npm run lint` | Run ESLint over the project. |
| `npm run format` | Format project files with Prettier. |

### Publishing and reporting commands

| Command | Description |
|---|---|
| `npm run publishing:preflight` | Run the publishing preflight checks. |
| `npm run publishing:dashboard` | Generate the local HTML publishing dashboard. |
| `npm run publication:update -- --word=... --platform=... --status=...` | Update a word's platform publication status. |
| `npm run publication:report` | Display publication progress and excluded packages. |

### YouTube commands

| Command | Description |
|---|---|
| `npm run youtube:auth` | Run YouTube OAuth authentication. |
| `npm run youtube:upload -- --word=...` | Upload a package video to YouTube after confirmation. |
| `npm run youtube:status -- --video-id=...` | Check YouTube video processing status. |
| `npm run youtube:history` | Display YouTube upload history. |

### Testing

Run the complete test suite:

```powershell
npm test
```

Equivalent command:

```powershell
npm run test:all
```

Individual test scripts are grouped by area:

- **Video and rendering:** `test:video-subtitles`, `test:video-template`, `test:video-render`, `test:flags`, `test:video-dynamic`, `test:video-service`, `test:responsive-layout`, `test:design-config`, `test:video-minimal`, `test:content-config`, `test:video-simple`, `test:video-quiz`, `test:quiz-timeline`, `test:quiz-audio`, `test:quiz-video`, `test:quiz-service`, `test:video-quality-check-service`.
- **Data and pipeline:** `test:excel-reader`, `test:excel-reader-validation`, `test:word-validator`, `test:pipeline-design`, `test:pipeline-normal`, `test:pipeline-simple`, `test:pipeline-quiz`, `test:runtime-video-options`, `test:output-path-service`.
- **Publishing:** `test:publishing-metadata`, `test:publishing-metadata-writer`, `test:publishing-content-validation-service`, `test:publishing-package-writer`, `test:publishing-readiness-service`, `test:publishing-queue-service`, `test:publishing-integration`, `test:publishing-preflight-service`, `test:publishing-preflight-cli`, `test:publishing-dashboard-service`, `test:publishing-dashboard-cli`.
- **Publication tracking and reports:** `test:publication-tracking-service`, `test:publication-status-cli`, `test:publication-report-service`.
- **YouTube:** `test:youtube-auth-service`, `test:youtube-upload-service`, `test:youtube-video-status-service`, `test:youtube-upload-history-service`, `test:youtube-history-cli`, `test:youtube-upload-cli`.

Tests may create temporary video/audio files and other fixtures under `output/` or temporary directories. The test suite includes service, CLI, and integration tests.

## Project structure

```text
language-video-factory/
├── assets/
│   └── flags/
├── data/
│   └── words.xlsx
├── src/
│   ├── commands/       # CLI commands, including publishing and YouTube tools
│   ├── config/         # Application and runtime configuration
│   ├── data/           # Excel input handling
│   ├── pipeline/       # Video generation pipeline
│   ├── services/       # Video, publishing, tracking, and YouTube services
│   ├── utils/          # Shared utilities
│   └── validators/     # Vocabulary validation
├── output/             # Generated media, packages, reports, and local history
├── package.json
├── requirements.txt
└── README.md
```

## Security and operational notes

- Never commit `.env`, API tokens, OAuth client secrets, OAuth token files, or other credentials.
- Use `.env.example` as the template for local environment configuration.
- Keep generated assets, local histories, publishing queue files, readiness reports, and the HTML dashboard in the ignored `output/` directory.
- The YouTube upload command defaults to private privacy, disables subscriber notifications, and requires explicit `UPLOAD` confirmation.
- `--force` only bypasses duplicate-upload protection; it does not remove the upload confirmation.
- A private YouTube upload is not considered a published social post. Update publication tracking only after actual publication.
- A `ready_for_review` result is an internal project check, not a guarantee of approval by TikTok, Instagram, or YouTube.
- Verify platform requirements and account-specific limits before manually publishing content.

## Development status

The project is under active development. The architecture and feature set may change as new functionality is added.
