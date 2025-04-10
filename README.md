# 🥣 Granola to Markdown

This is a script that exports Granola meeting notes and transcripts to Markdown files.

## Features

- Finds the Granola cache-v3.json file automatically
- Extracts meeting data, notes, and transcripts
- Creates formatted Markdown files for each meeting
- Supports filtering by date range
- Handles attendee information from both meeting metadata and calendar events
- Interactive command-line interface with helpful options
- Visual progress indication with detailed feedback
- Comprehensive error messages with suggestions
- Works with both Bun and Node.js runtimes

## Usage

```bash
# Run with default settings (all meetings, export to ~/meetings)
bun index.ts

# Show help with all available options
bun index.ts --help

# Export meetings from the last 7 days
bun index.ts --days 7

# Force overwrite of existing files
bun index.ts --force

# Specify output directory
bun index.ts --output /path/to/output

# Display detailed logs
bun index.ts --verbose

# Combine options
bun index.ts --days 14 --force --output ./my-meetings --verbose
```

## Default behavior

- Exports all meetings from all time (no date filter)
- Saves files to `~/meetings` directory
- Skips existing files unless `--force` is specified
- Filenames are formatted as `YYYY-MM-DD-meeting-title.md`

## Markdown format

Each exported meeting file includes:

- Meeting title as H1 heading
- Meeting date
- List of attendees (from metadata or calendar)
- Meeting notes (in Markdown format if available)
- Full transcript with speaker information

## Requirements

- Bun runtime (for local execution)
- Node.js (if using npx)
- Granola desktop app installed with cache-v3.json file

## Using with npx

Once published to npm, you can run the tool without installation:

```bash
npx granola-to-markdown
npx granola-to-markdown --help
npx granola-to-markdown --days 7 --force
npx granola-to-markdown --output /path/to/output
npx granola-to-markdown --days 14 --force --verbose
```

## How it works

The script:
1. Locates the Granola cache file at `~/Library/Application Support/Granola/cache-v3.json`
2. Parses the nested JSON structure to extract meeting data
3. Filters for valid meetings within the specified date range
4. Formats each meeting as a Markdown file
5. Saves the files to the specified output directory