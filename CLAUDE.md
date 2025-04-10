# CLAUDE.md - Granola Meetings Exporter

This file provides guidance for Claude Code when working with this repository.

## Project Overview

This is a utility that exports Granola meeting notes and transcripts to Markdown files. It reads the Granola desktop app's cache file and creates formatted markdown documents for each meeting.

## Key Files

- `index.ts`: The main script that handles finding, parsing, and exporting meetings
- `README.md`: Documentation and usage instructions
- `package.json`: Project dependencies and scripts

## Common Tasks

### Adding Features

When adding features to the exporter, consider the following:
1. Maintain the simple standalone nature of the script
2. Follow existing patterns for error handling and logging
3. Update the README.md documentation when adding new command-line options

### Handling Cache Format

The Granola cache-v3.json file has a specific structure:
1. The file contains a JSON object with a "cache" property
2. The "cache" property contains another JSON string that needs to be parsed
3. The actual data is in the "state" property of the parsed cache

## Granola Cache Structure

The cache-v3.json file has the following hierarchical structure:

```
cache-v3.json
├── cache (JSON string that needs parsing)
    ├── state
    │   ├── documents (keyed by UUID)
    │   │   ├── [doc-id]
    │   │   │   ├── id: String
    │   │   │   ├── created_at: Timestamp
    │   │   │   ├── updated_at: Timestamp
    │   │   │   ├── deleted_at: Timestamp
    │   │   │   ├── title: String
    │   │   │   ├── user_id: String
    │   │   │   ├── notes_plain: String
    │   │   │   ├── notes_markdown: String
    │   │   │   ├── transcribe: Boolean
    │   │   │   ├── public: Boolean
    │   │   │   ├── privacy_mode_enabled: Boolean
    │   │   │   ├── notes: Object
    │   │   │   │   ├── type: String
    │   │   │   │   └── content: Array
    │   │   │   └── google_calendar_event: Object
    │   │   │       ├── id: String
    │   │   │       ├── summary: String
    │   │   │       ├── start: Object
    │   │   │       ├── end: Object
    │   │   │       ├── attendees: Array
    │   │   │       ├── conferenceData: Object
    │   │   │       ├── htmlLink: String
    │   │   │       └── hangoutLink: String
    │   ├── transcripts (keyed by document ID)
    │   │   ├── [doc-id]
    │   │   │   └── entries: Array
    │   │   │       ├── text: String
    │   │   │       ├── source: String (e.g., "microphone")
    │   │   │       ├── speaker: String
    │   │   │       ├── timestamp: Timestamp
    │   │   │       └── sequence_number: Number
    │   ├── meetingsMetadata (keyed by document ID)
    │   │   ├── [doc-id]
    │   │   │   ├── creator: Object
    │   │   │   │   ├── name: String
    │   │   │   │   ├── email: String
    │   │   │   │   └── details: Object
    │   │   │   ├── attendees: Array
    │   │   │   ├── conferencing: Object
    │   │   │   └── url: String
    │   ├── calendars
    │   ├── events
    │   └── panelTemplates
    └── version: Number
```

Key relationships:
- Documents are the central objects, containing meeting details
- Transcripts are keyed by document ID (1:1 relationship)
- MeetingsMetadata are also keyed by document ID (1:1 relationship)
- Each document may have calendar events and attendees

Important notes:
- The script primarily focuses on documents, transcripts, and meetingsMetadata
- Attendees can come from either meetingsMetadata.attendees or google_calendar_event.attendees
- Transcripts should be sorted by sequence_number for proper chronological order

### Transcript Handling

When working with transcript data:
1. Sort transcript entries by sequence_number
2. Format speaker names based on the source (microphone = "me")
3. Handle cases where transcript data might be missing

## Code Style Guidelines

- Use modern TypeScript features
- Provide clear error messages and helpful console output
- Maintain type definitions for the Granola data structures

## Testing

Test the script with various scenarios:
- Different date ranges
- Handling missing or corrupted cache file
- Processing meetings with and without transcripts
- Various output directory configurations

## Linting

Run the type checker before committing changes:

```bash
bun typecheck
```