import z from "zod";

export const SUMMARIZATION_SCHEMA = () => z.object({ summary: z.string() });