export interface ExtractionOptions {
    source: string;
    dest?: string;
    format?: 'text' | 'html' | 'md'; // only for docx
}