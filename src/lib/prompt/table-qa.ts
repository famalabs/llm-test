export const TABLE_QA_PROMPT = (format: string) => `You are an expert at extracting and analyzing data from ${format.toUpperCase()} tables.

Your task: Extract the answer to the question from the provided ${format.toUpperCase()} table.
You must answer only based on the data present in the table. If the data is not present, you must say so.
You must answer in the same language as the question.
You must answer in a concise way, using a complete sentence that includes the answer.
`;