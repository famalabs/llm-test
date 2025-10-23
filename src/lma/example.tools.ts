
export interface LMATool {
    name: string;
    description: string;
    parameters?: {
        name: string;
        type: 'string' | 'number' | 'boolean';
        description: string;
    }[];
}

export const example_lma_tools: LMATool[] = [
    {
        name: "rag-from-docs",
        description: "Retrieve information from a set of documents about different pharmsaceutical products.",
    },
    {
        name: "therapy",
        description: "Retrieve the therapy information of the user.",
    },
    {
        name: "logs",
        description: "Retrieve the logs of the user containing previous vitals, medications, and symptoms.",
        parameters: [
            { name: "date", type: "string", description: "The date for which to retrieve the logs, in YYYY-MM-DD format." }
        ]
    },
    {
        name: "chats",
        description: "Retrieve information from previous chat conversations with the user.",
        parameters: [
            { name: "date", type: "string", description: "The date for which to retrieve the chat history, in YYYY-MM-DD format." }
        ]
    },
    {
        name: "user_profile",
        description: "Retrieve the user profile information.",
    },
    {
        name: "doctors",
        description: "Retrieve the available information about the user's doctors.",
    }
]