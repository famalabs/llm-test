import { z } from 'zod';

export const TherapySchema = z.object({
    therapy_drugs: z.array(z.object({
        drug_name: z.string().nullish().describe('Commercial drug name'),
        drug_api: z.string().nullish().describe('Active ingredient of the drug'),
        schedule: z.object({
            day: z.number().describe('Starting day from 0'),
            timetable: z.array(z.object({
                dose: z.number().describe('Units per administration (e.g., tablets, ml, etc.)'),
                hour: z.string().regex(/^\d{2}:\d{2}$/).nullish().describe('Time in "HH:MM" format'),
                hour_text: z.string().nullish().describe('Additional time indication, e.g., "morning and evening"'),
            })).nullish().describe('Timetable data for drug administration'),
            duration: z.number().nullish().describe('Total duration in days (from start day)'),
            period_duration: z.number().nullish().describe('Cycle length in days (e.g., 1=daily, 7=weekly, etc.)'),
            period_days: z.array(z.object({
                day: z.number().describe('Specific day within the period starting from 0'),
                timetable: z.array(z.object({
                    dose: z.number().describe('Units per administration for this period day'),
                    hour: z.string().regex(/^\d{2}:\d{2}$/).nullish().describe('Time for this period day'),
                    hour_text: z.string().nullish().describe('Additional time indication for this period day'),
                })).nullish().describe('Timetable for this specific period day'),
            })).nullish().describe('Specific days within the period'),
        }).describe('Therapy schedule including timing and duration details'),
        optional: z.boolean().nullish().describe('If the drug is optional (e.g., as needed)'),
        notes: z.string().nullish().describe('Additional notes about the drug administration'),
    })),
});

export const MarkdownTableTherapySchema = z.object({
    markdown: z.string().describe('Single Markdown string containing ONLY a well-formatted drug table with all current therapy information (no extra text), using the same language as the input text.')
});