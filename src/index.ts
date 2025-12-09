#!/usr/bin/env node

import { Command } from 'commander';
import axios, { AxiosInstance } from 'axios';
import TurndownService from 'turndown';
import * as fs from 'fs';
import * as path from 'path';

interface ConfluencePageResponse {
  id: string;
  type: string;
  status: string;
  title: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

interface ConfluenceAttachment {
  id: string;
  type: string;
  title: string;
  metadata: {
    mediaType: string;
  };
  _links: {
    download: string;
  };
}

interface ConfluenceAttachmentsResponse {
  results: ConfluenceAttachment[];
  size: number;
}

class ConfluenceToMarkdown {
  private client: AxiosInstance;
  private turndownService: TurndownService;
  private baseUrl: string;

  constructor(email: string, token: string, baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: `${baseUrl}/wiki/rest/api`,
      auth: {
        username: email,
        password: token
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });

    this.configureTurndown();
  }

  private configureTurndown(): void {
    this.turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => `~~${content}~~`
    });

    this.turndownService.addRule('tables', {
      filter: 'table',
      replacement: (content, node: any) => {
        const rows: string[][] = [];
        const tableRows = Array.from(node.querySelectorAll('tr'));
        
        tableRows.forEach((tr: any) => {
          const cells: string[] = [];
          const tableCells = Array.from(tr.querySelectorAll('th, td'));
          
          tableCells.forEach((cell: any) => {
            const cellContent = cell.textContent.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
            cells.push(cellContent);
          });
          
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        if (rows.length === 0) return '';

        const columnCount = Math.max(...rows.map(row => row.length));
        let markdownTable = '\n\n';

        rows.forEach((row, index) => {
          while (row.length < columnCount) row.push('');
          markdownTable += '| ' + row.join(' | ') + ' |\n';
          
          if (index === 0) {
            markdownTable += '| ' + row.map(() => '---').join(' | ') + ' |\n';
          }
        });

        return markdownTable + '\n';
      }
    });

    this.turndownService.addRule('taskList', {
      filter: (node) => {
        return node.nodeName === 'LI' && node.classList && node.classList.contains('task-list-item');
      },
      replacement: (content, node: any) => {
        const checkbox = node.querySelector('input[type="checkbox"]');
        const checked = checkbox && checkbox.checked ? 'x' : ' ';
        return `- [${checked}] ${content}\n`;
      }
    });
  }

  private parseConfluenceUrl(url: string): string {
    const urlPattern = /\/pages\/(\d+)\//;
    const match = url.match(urlPattern);
    
    if (!match || !match[1]) {
      throw new Error(`Invalid Confluence URL format. Expected format: https://domain.atlassian.net/wiki/spaces/SPACE/pages/PAGEID/Title`);
    }

    return match[1];
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 200)
      .toLowerCase();
  }

  async fetchPage(pageId: string): Promise<ConfluencePageResponse> {
    try {
      const response = await this.client.get<ConfluencePageResponse>(
        `/content/${pageId}`,
        {
          params: {
            expand: 'body.storage'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to fetch page: ${error.response.status} ${error.response.statusText}`);
      }
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
  }

  async fetchAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    try {
      const response = await this.client.get<ConfluenceAttachmentsResponse>(
        `/content/${pageId}/child/attachment`,
        {
          params: {
            limit: 100
          }
        }
      );
      return response.data.results;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to fetch attachments: ${error.response.status} ${error.response.statusText}`);
      }
      throw new Error(`Failed to fetch attachments: ${error.message}`);
    }
  }

  async downloadAttachment(downloadPath: string, outputDir: string, filename: string): Promise<string> {
    try {
      const fullUrl = `${this.baseUrl}${downloadPath}`;
      const response = await this.client.get(fullUrl, {
        responseType: 'arraybuffer'
      });

      const attachmentsDir = path.join(outputDir, 'attachments');
      if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
      }

      const sanitized = this.sanitizeFilename(filename);
      const filepath = path.join(attachmentsDir, sanitized);
      fs.writeFileSync(filepath, response.data);

      return filepath;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to download attachment: ${error.response.status} ${error.response.statusText}`);
      }
      throw new Error(`Failed to download attachment: ${error.message}`);
    }
  }

  convertToMarkdown(html: string): string {
    return this.turndownService.turndown(html);
  }

  saveMarkdown(content: string, outputPath: string): string {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  async export(url: string, outputFile: string | null, outputDir: string, saveAttachments: boolean): Promise<void> {
    console.log('Parsing Confluence URL...');
    const pageId = this.parseConfluenceUrl(url);
    console.log(`Page ID: ${pageId}`);

    console.log('Fetching page content...');
    const page = await this.fetchPage(pageId);
    console.log(`Page title: ${page.title}`);

    console.log('Converting to Markdown...');
    const markdown = this.convertToMarkdown(page.body.storage.value);

    console.log('Saving Markdown file...');
    let filepath: string;
    
    if (outputFile) {
      filepath = this.saveMarkdown(markdown, outputFile);
    } else {
      const filename = this.sanitizeFilename(page.title);
      const fullPath = path.join(outputDir, `${filename}.md`);
      filepath = this.saveMarkdown(markdown, fullPath);
    }
    
    console.log(`✓ Saved: ${filepath}`);

    if (saveAttachments) {
      console.log('Fetching attachments...');
      const attachments = await this.fetchAttachments(pageId);
      
      if (attachments.length === 0) {
        console.log('No attachments found.');
      } else {
        console.log(`Found ${attachments.length} attachment(s). Downloading...`);
        
        const attachmentDir = outputFile ? path.dirname(outputFile) : outputDir;
        
        for (const attachment of attachments) {
          console.log(`  Downloading: ${attachment.title}`);
          const savedPath = await this.downloadAttachment(
            attachment._links.download,
            attachmentDir,
            attachment.title
          );
          console.log(`  ✓ Saved: ${savedPath}`);
        }
      }
    }

    console.log('\nExport completed successfully.');
  }
}

function validateEnvironment(): { email: string; token: string } {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_TOKEN;

  if (!email) {
    console.error('Error: ATLASSIAN_EMAIL environment variable is not set.');
    process.exit(1);
  }

  if (!token) {
    console.error('Error: ATLASSIAN_TOKEN environment variable is not set.');
    process.exit(1);
  }

  return { email, token };
}

function extractBaseUrl(url: string): string {
  const match = url.match(/(https?:\/\/[^\/]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid URL format. Could not extract base URL.');
  }
  return match[1];
}

const program = new Command();

program
  .name('confluence-to-markdown')
  .description('Export Confluence pages to Markdown')
  .version('1.0.0')
  .argument('<url>', 'Full Confluence page URL')
  .option('-f, --file <path>', 'Output file path (overrides -o and uses sanitized page title)')
  .option('-o, --output <directory>', 'Output directory', './output')
  .option('--save-attachments', 'Download and save page attachments', false)
  .action(async (url: string, options) => {
    try {
      const { email, token } = validateEnvironment();
      const baseUrl = extractBaseUrl(url);
      
      const exporter = new ConfluenceToMarkdown(email, token, baseUrl);
      await exporter.export(url, options.file || null, options.output, options.saveAttachments);
    } catch (error: any) {
      console.error(`\nError: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();

