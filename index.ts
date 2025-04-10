#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import ora from 'ora';

// Types for the Granola cache data
interface Document {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  notes_markdown: string;
  notes_plain: string;
  transcribe: boolean;
  public: boolean;
  valid_meeting: boolean;
  privacy_mode_enabled: boolean;
  google_calendar_event?: StandaloneEvent;
}

interface StandaloneEvent {
  id: string;
  summary?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  start?: {
    dateTime: string;
  };
  end?: {
    dateTime: string;
  };
}

interface TranscriptEntry {
  id: string;
  text: string;
  source: string;
  speaker: string;
  start_timestamp: string;
  end_timestamp: string;
  sequence_number: number;
}

interface MeetingMetadata {
  id: string;
  creator?: {
    name?: string;
    email?: string;
  };
  attendees?: Array<{
    name?: string;
    email?: string;
  }>;
}

/**
 * Gets the resolved path to the output directory
 */
function resolveOutputDir(outputDir: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) {
    throw new Error('Unable to determine home directory');
  }
  
  // Replace ~ with home directory if present
  return outputDir.startsWith('~') 
    ? join(homeDir, outputDir.substring(1)) 
    : outputDir;
}

/**
 * Gets the path to the Granola cache file
 */
function getCacheFilePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (!homeDir) {
    throw new Error('Unable to determine home directory');
  }
  
  return join(homeDir, 'Library', 'Application Support', 'Granola', 'cache-v3.json');
}

/**
 * Formats attendees information
 */
function formatAttendees(meeting: Document, metadata: MeetingMetadata | undefined): string[] {
  const attendees: string[] = [];
  
  // Get attendees from metadata or calendar event
  if (metadata?.attendees && metadata.attendees.length > 0) {
    attendees.push(...metadata.attendees
      .map(a => `${a.name || ''}${a.name && a.email ? ' ' : ''}${a.email ? `<${a.email}>` : ''}`.trim())
      .filter(Boolean));
  } else if (meeting.google_calendar_event?.attendees) {
    attendees.push(...meeting.google_calendar_event.attendees
      .map(a => `${a.displayName || ''}${a.displayName && a.email ? ' ' : ''}${a.email ? `<${a.email}>` : ''}`.trim())
      .filter(Boolean));
  }
  
  // Add creator if available
  if (metadata?.creator) {
    const creatorStr = `${metadata.creator.name || ''}${metadata.creator.name && metadata.creator.email ? ' ' : ''}${metadata.creator.email ? `<${metadata.creator.email}>` : ''}`.trim();
    if (creatorStr && !attendees.includes(creatorStr)) {
      attendees.unshift(creatorStr); // Add creator at the beginning
    }
  }
  
  return attendees;
}

/**
 * Formats transcript entries
 */
function formatTranscript(transcriptEntries: TranscriptEntry[]): string {
  // Sort transcript entries by sequence number
  const sortedTranscript = [...transcriptEntries].sort((a, b) => a.sequence_number - b.sequence_number);
  
  // Format transcript
  return sortedTranscript
    .map((entry: TranscriptEntry) => {
      const speaker = entry.source === 'microphone' ? 'me' : entry.speaker || 'them';
      return `${speaker}: ${entry.text}`;
    })
    .join('\n');
}

/**
 * Format date and time for display
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Format meeting duration if start and end times are available
 */
function formatDuration(meeting: Document): string {
  if (!meeting.google_calendar_event?.start?.dateTime || !meeting.google_calendar_event?.end?.dateTime) {
    return '';
  }
  
  const start = new Date(meeting.google_calendar_event.start.dateTime);
  const end = new Date(meeting.google_calendar_event.end.dateTime);
  const durationMs = end.getTime() - start.getTime();
  
  // Format duration as "X hours Y minutes"
  const hours = Math.floor(durationMs / (60 * 60 * 1000));
  const minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/**
 * Format attendees as a bulleted list
 */
function formatAttendeesAsList(attendees: string[]): string {
  if (attendees.length === 0) {
    return '*No attendees recorded*';
  }
  
  return attendees.map(attendee => `- ${attendee}`).join('\n');
}

/**
 * Generates markdown content for a meeting
 */
function generateMarkdown(meeting: Document, attendeesList: string[], formattedTranscript: string): string {
  const meetingDate = new Date(meeting.created_at);
  const formattedDate = formatDateTime(meeting.created_at);
  
  // Format meeting times if available
  let timeInfo = '';
  if (meeting.google_calendar_event?.start?.dateTime) {
    const startTime = formatDateTime(meeting.google_calendar_event.start.dateTime);
    
    if (meeting.google_calendar_event?.end?.dateTime) {
      const endTime = formatDateTime(meeting.google_calendar_event.end.dateTime);
      const duration = formatDuration(meeting);
      timeInfo = `**Start:** ${startTime}\n**End:** ${endTime}\n**Duration:** ${duration}`;
    } else {
      timeInfo = `**Start:** ${startTime}`;
    }
  } else {
    timeInfo = `**Date:** ${formattedDate}`;
  }
  
  // Format attendees as a list
  const formattedAttendees = formatAttendeesAsList(attendeesList);
  
  return `# ${meeting.title}

${timeInfo}

---

## Attendees

${formattedAttendees}

---

## Notes

${meeting.notes_markdown || meeting.notes_plain || '*No notes recorded*'}

---

## Transcript

${formattedTranscript || '*No transcript available*'}
`;
}

/**
 * Main function to read cache and export meetings
 */
async function exportGranolaMeetings(
  outputDir: string = '~/meetings', 
  daysAgo: number | null = null, 
  force: boolean = false,
  verbose: boolean = false
): Promise<void> {
  try {
    // Start spinner
    spinner.start('Initializing export process');
    
    // Resolve paths
    const resolvedOutputDir = resolveOutputDir(outputDir);
    const cacheFilePath = getCacheFilePath();
    
    if (verbose) {
      spinner.info(`Looking for Granola cache file at: ${cacheFilePath}`);
    }
    
    if (!existsSync(cacheFilePath)) {
      throw new Error(`Cache file not found at ${cacheFilePath}. Make sure Granola is installed and has been used.`);
    }
    
    // Create output directory if it doesn't exist
    await mkdir(resolvedOutputDir, { recursive: true });
    if (verbose) {
      spinner.info(`Output directory: ${resolvedOutputDir}`);
    }
    
    // Read and parse cache file
    spinner.text = 'Reading Granola cache file';
    let cacheContent;
    try {
      // Try to use Bun API if available
      if (typeof Bun !== 'undefined') {
        cacheContent = await Bun.file(cacheFilePath).text();
      } else {
        // Fallback to Node.js fs
        cacheContent = await import('node:fs/promises').then(fs => fs.readFile(cacheFilePath, 'utf-8'));
      }
      if (!cacheContent) {
        throw new Error('Cache file is empty. Try restarting Granola to regenerate the cache.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read cache file: ${errorMessage}`);
    }
    
    spinner.text = 'Parsing Granola data structure';
    const parsedCache = JSON.parse(cacheContent);
    if (!parsedCache.cache) {
      throw new Error('Invalid cache format - missing "cache" property. Cache may be corrupted.');
    }
    
    const cacheData = JSON.parse(parsedCache.cache);
    if (!cacheData?.state?.documents) {
      throw new Error('Invalid cache data structure: missing state.documents. Cache may be corrupted.');
    }
    
    // Calculate date range for filtering
    const now = new Date();
    let startDate: Date | null = null;
    let dateRangeMessage = '';
    
    if (daysAgo !== null) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysAgo);
      dateRangeMessage = `Ready to export meetings from ${startDate.toLocaleDateString()} to ${now.toLocaleDateString()}`;
    } else {
      dateRangeMessage = 'Ready to export all meetings (no date filter)';
    }
    
    spinner.succeed(dateRangeMessage);
    
    // Get meetings
    spinner.text = 'Analyzing meetings data';
    const documentsObj = cacheData.state.documents;
    const documents = Object.values(documentsObj) as Document[];
    const meetingsMetadata = cacheData.state.meetingsMetadata || {};
    const transcripts = cacheData.state.transcripts || {};
    
    if (verbose) {
      spinner.info(`Found ${documents.length} total documents in cache`);
    }
    
    // Filter for valid meetings within date range
    const meetings = documents.filter(doc => {
      if (!doc.valid_meeting || doc.deleted_at) return false;
      
      // If no date filter is specified, include all meetings
      if (startDate === null) return true;
      
      const meetingDate = new Date(doc.created_at);
      return meetingDate >= startDate && meetingDate <= now;
    });
    
    if (meetings.length === 0) {
      if (daysAgo !== null) {
        spinner.warn(`No meetings found in the date range. Try increasing the days with --days option.`);
      } else {
        spinner.warn(`No valid meetings found in the cache.`);
      }
      return;
    }
    
    const successMessage = daysAgo !== null 
      ? `Found ${meetings.length} valid meetings in the date range`
      : `Found ${meetings.length} valid meetings`;
    spinner.succeed(successMessage);
    
    let exportedCount = 0;
    let skippedCount = 0;
    const skippedFiles: string[] = [];
    
    // Export meetings with progress
    spinner.start(`Exporting meetings [0/${meetings.length}]`);
    
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      spinner.text = `Exporting meetings [${i+1}/${meetings.length}]: ${meeting.title || 'Untitled meeting'}`;
      
      // Format date for filename
      const meetingDate = new Date(meeting.created_at);
      const formattedDate = meetingDate.toISOString().split('T')[0];
      
      // Sanitize title for filename
      const sanitizedTitle = meeting.title
        ? meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : `untitled-meeting-${meeting.id}`;
      
      // Generate filename
      const filename = `${formattedDate}-${sanitizedTitle}.md`;
      const filePath = join(resolvedOutputDir, filename);
      
      // Skip if file already exists and force is false
      if (!force && existsSync(filePath)) {
        if (verbose) {
          spinner.info(`Skipped (already exists): ${filename}`);
        }
        skippedCount++;
        skippedFiles.push(filename);
        continue;
      }
      
      // Get metadata and format content
      const metadata = meetingsMetadata[meeting.id];
      const attendees = formatAttendees(meeting, metadata);
      const attendeesList = attendees.join(', ');
      
      const transcriptEntries = transcripts[meeting.id] || [];
      const formattedTranscript = formatTranscript(transcriptEntries);
      
      // Generate and save markdown content
      const markdown = generateMarkdown(meeting, attendees, formattedTranscript);
      await writeFile(filePath, markdown);
      
      if (verbose) {
        spinner.info(`Exported: ${filename}`);
      }
      exportedCount++;
    }
    
    // Show final summary
    spinner.succeed(`Export complete! Exported ${exportedCount} meetings, skipped ${skippedCount} meetings${skippedCount > 0 ? ' (already exist, use --force to overwrite)' : ''}.`);
    console.log(`\n✨ Files saved to: ${resolvedOutputDir}`);
    
    // Show detailed skip information if there are skipped files and verbose mode is on
    if (skippedCount > 0 && verbose) {
      console.log(`\nSkipped meetings (already exist):`);
      skippedFiles.slice(0, 10).forEach(file => console.log(`- ${file}`));
      
      if (skippedFiles.length > 10) {
        console.log(`... and ${skippedFiles.length - 10} more`);
      }
      
      console.log(`\nUse --force option to overwrite existing files.`);
    }
    
  } catch (error) {
    // Error handling is done in the caller
    throw error;
  }
}

// Create a global spinner instance for progress indication
const spinner = ora();

// Setup CLI with commander
const program = new Command();

program
  .name('granola-to-markdown')
  .description('Export Granola meeting notes and transcripts to Markdown files')
  .version('1.0.0')
  .option('-d, --days <number>', 'number of days to look back for meetings (defaults to all time if not specified)')
  .option('-f, --force', 'force overwrite of existing files', false)
  .option('-o, --output <path>', 'output directory path', '~/meetings')
  .option('-v, --verbose', 'show detailed logs', false)
  .helpOption('-h, --help', 'display help information');

program.parse();
const options = program.opts();

// Run the export with parsed options
let days: number | null = null;

if (options.days) {
  days = parseInt(options.days, 10);
  if (isNaN(days) || days < 1) {
    console.error('Error: Days must be a positive number');
    process.exit(1);
  }
}

// Run the export
exportGranolaMeetings(options.output, days, options.force, options.verbose)
  .then(() => process.exit(0))
  .catch(err => {
    spinner.fail();
    if (err instanceof Error) {
      console.error(`\n❌ Error: ${err.message}`);
      
      // Provide helpful suggestions based on error message
      if (err.message.includes('Cache file not found')) {
        console.error('\nSuggestions:');
        console.error('- Make sure Granola desktop app is installed and has been used');
        console.error('- The cache file should be located at ~/Library/Application Support/Granola/cache-v3.json');
      } else if (err.message.includes('home directory')) {
        console.error('\nSuggestion: Your home directory could not be determined. Try specifying an absolute path with --output.');
      }
    } else {
      console.error(`\n❌ Unexpected error occurred`);
    }
    process.exit(1);
  });