# Confluence to Markdown

CLI tool to export Confluence Cloud pages to Markdown format.

## Features

- Exports single Confluence page to Markdown
- Preserves formatting (headings, lists, tables, code blocks, links, images)
- Optional attachment downloads
- Fail-fast error handling
- Clean sanitized filenames

## Prerequisites

- Node.js 18+ and Yarn
- Confluence Cloud account
- Atlassian API token

## Installation

```bash
yarn install
yarn build
```

## Configuration

Set the following environment variables:

```bash
export ATLASSIAN_EMAIL="your-email@example.com"
export ATLASSIAN_TOKEN="your-api-token"
```

### Creating an Atlassian API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label and click "Create"
4. Copy the token (you won't be able to see it again)

## Usage

### Basic Usage

```bash
yarn start "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title"
```

Or using the compiled binary:

```bash
node dist/index.js "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title"
```

### With Attachments

```bash
yarn start "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title" --save-attachments
```

### Custom Output Directory

```bash
yarn start "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title" -o ./my-exports
```

### Specify Output File

```bash
yarn start "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title" -f ./my-page.md
```

### All Options

```bash
yarn start [options] <url>

Arguments:
  url                              Full Confluence page URL

Options:
  -V, --version                    Output version number
  -f, --file <path>                Output file path (overrides -o)
  -o, --output <directory>         Output directory (default: "./output")
  --save-attachments               Download and save page attachments
  -h, --help                       Display help
```

## Output Structure

### Without Attachments (default directory)

```
output/
└── page-title.md
```

### With Attachments (default directory)

```
output/
├── page-title.md
└── attachments/
    ├── image-1.png
    ├── document.pdf
    └── spreadsheet.xlsx
```

### Using --file option

```
./
├── my-page.md
└── attachments/
    └── image-1.png
```

## Development

### Run in Development Mode

```bash
yarn dev "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title"
```

### Build

```bash
yarn build
```

## Error Handling

The application fails fast on errors:

- Missing environment variables
- Invalid Confluence URL format
- Authentication failures
- Network errors
- Page not found (404)
- Permission denied (403)

## Markdown Conversion

The tool converts Confluence HTML storage format to Markdown with support for:

- Headings (H1-H6)
- Bold, italic, strikethrough
- Ordered and unordered lists
- Task lists (checkboxes)
- Tables
- Code blocks (inline and fenced)
- Links and images
- Blockquotes
- Horizontal rules

## License

MIT

