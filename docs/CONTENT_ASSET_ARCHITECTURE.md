# JATSWeb Content and Asset Architecture

This document defines the first-stage architecture after the asset/data decoupling decision.

## Goal

JATSWeb uses a static Cloudflare Pages core while separating larger public assets from the Git repository.

- Keep the website deployable without a build step.
- Keep GitHub focused on source code, UI, metadata, and small assets.
- Move large downloadable assets to Cloudflare R2.
- Keep public pages read-only.
- Keep editing, upload, preview, and push inside the local Admin Tool.

## Layers

| Layer | Primary storage | Responsibility |
| --- | --- | --- |
| Presentation Layer | GitHub + Cloudflare Pages | HTML, CSS, JS, SEO files, small static assets |
| Content Layer | `data/*.json` | Profile, projects, links, tools, formulas, file metadata |
| Asset Layer | Git assets + Cloudflare R2 | Small checked-in assets and large downloadable files |
| Admin Layer | Local `WebPageAdmin` | Visual editing, preview, upload routing, Git commit/push |
| Future Dynamic Layer | Pages Functions / D1 / KV | API search, dynamic indexes, protected tool workflows |

## Storage Providers

Public file metadata must declare where the physical asset is stored.

### Git Asset

Use this for small files that are safe to deploy with Cloudflare Pages.

```json
{
  "id": "01-1b8c4c",
  "name": "test01",
  "description": "Public test document.",
  "fileName": "01-1b8c4c.docx",
  "storage_provider": "git",
  "storage_key": "assets/files/01-1b8c4c.docx",
  "public_url": "/assets/files/01-1b8c4c.docx",
  "extension": "docx",
  "size": 3029853,
  "uploadedAt": "2026-04-30T04:26:49.270Z"
}
```

Rules:

- Keep Git assets below 10 MiB by default.
- Never commit a single file above 25 MiB. Cloudflare Pages will reject it.
- Use Git assets only for public, non-sensitive files.

### Cloudflare R2 Asset

Use this for larger public files.

```json
{
  "id": "large-report-001",
  "name": "Large Report",
  "description": "Public large PDF stored outside the repo.",
  "fileName": "large-report.pdf",
  "storage_provider": "r2",
  "storage_key": "documents/large-report.pdf",
  "public_url": "https://files.joshhuang.ccwu.cc/api/assets/documents/large-report.pdf",
  "extension": "pdf",
  "size": 30463153,
  "uploadedAt": "2026-05-02T00:00:00.000Z"
}
```

Rules:

- R2 is the default provider for files above 10 MiB.
- R2 is mandatory for files above 25 MiB.
- Public pages only read `public_url`; they never receive R2 credentials.
- To enforce free-tier protection, R2 downloads should route through the guarded Pages Function proxy at `/api/assets/*`. Do not expose the R2 bucket directly for files that must be quota-controlled.
- R2 object keys should be stable and grouped by type, such as `documents/`, `wallpapers/`, `archives/`, or `code/`.

## Admin Tool Direction

The local Admin Tool should become the only write surface.

Required behavior:

1. User selects a file in the browser UI.
2. Admin checks extension and size.
3. If the file is small, Admin may store it under `assets/files/`.
4. If the file is above the Git threshold, Admin uploads it to R2.
5. Admin writes a metadata entry to `data/files.json`.
6. Admin starts local preview.
7. Admin runs checks.
8. Admin commits and pushes metadata and small assets only.

The public Cloudflare Pages website must never expose upload, delete, token, or R2 credential operations.

## Required User Setup

The user must create and configure Cloudflare resources before R2 upload automation can be enabled.

1. Create a Cloudflare R2 bucket.
2. Choose a public custom domain for assets, recommended:

```text
files.joshhuang.ccwu.cc
```

3. Connect the custom domain to the R2 bucket in Cloudflare.
4. Create an R2 API token for local Admin use only.
5. Store credentials locally in `C:\Code\WebPageAdmin\.env`.
6. Never commit the `.env` file.

Suggested local environment variables:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://files.joshhuang.ccwu.cc/api/assets
```

Quota guard environment variables for Cloudflare Pages:

```text
ENFORCE_QUOTA_GUARD=true
LIMIT_API_DAILY_REQUESTS=90000
LIMIT_YOUTUBE_DAILY_UNITS=9000
LIMIT_R2_MONTHLY_CLASS_B=9000000
```

Required Cloudflare bindings:

```text
USAGE_KV       # Workers KV namespace for quota counters
ASSETS_BUCKET  # R2 bucket binding for guarded file downloads
```

## Implementation Status

- Public Files renderer supports both `git` and `r2` metadata.
- Current checked-in file uses `storage_provider: "git"`.
- Oversized local PDF is ignored and not deployed.
- Full R2 upload support in Admin requires the Cloudflare setup above.
