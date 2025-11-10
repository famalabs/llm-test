import z from "zod";

export const A_PRIORI_CLASSIFICATION_SCHEMA = z.object({
    task_interaction: z.boolean(),
    user_request: z.boolean()
});