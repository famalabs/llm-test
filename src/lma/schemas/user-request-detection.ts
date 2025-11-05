import z from "zod";

export const USER_REQUEST_DETECTION_SCHEMA = () => z.object({ user_request: z.string().nullish().describe("The detected user request as a string.") });
export const USER_SATISFACTION_DETECTION_SCHEMA = () => z.object({ request_satisfied: z.boolean().nullish().describe("Indicates if the user request was satisfied.") });
export const USER_REQUEST_AND_TOOLS_DETECTION_SCHEMA = (includeToolsParams: boolean) => {

    const user_request = z.string().nullish().describe("The detected user request as a string.");

    if (includeToolsParams) {
        return z.object({
            user_request,
            useful_tools: z.array(z.object({
                name: z.string().describe("The name of the tool."),
                parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullish().describe("A key-value map of parameters for the tool.")
            })).nullish().describe("An array of useful tools with their parameters to fulfill the user request."),
        });
    }

    return z.object({
        user_request,
        useful_tools: z.array(z.object({ name: z.string().describe("The name of the tool.") })).nullish().describe("An array of tool names that are useful to fulfill the user request."),
    });
}