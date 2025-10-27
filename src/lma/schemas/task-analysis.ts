import z from "zod";

export const TASK_ANALYSIS_SCHEMA = (answerType: 'string' | 'number' | 'boolean') => {
    const zAnswerType = answerType == 'string' ? z.string() :
        answerType == 'number' ? z.number() :
            z.boolean();

    const schema = z.object({
        status: z.enum(['answered', 'ignored', 'negated', 'wait']).optional().describe("Task status"),
        answer: zAnswerType.optional().nullable().describe("Task answer, present only if status is 'answered'"),
        notes: z.string().optional().nullable().describe("Additional notes, present only if status is 'answered'")
    }); 
    return schema;
}