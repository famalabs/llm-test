import { tool } from "ai";
import z from "zod";

export const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const dummyTools = {
    getWeather: tool({
        description: 'Get the current weather in a given city. Input should be a city name like "Milan" or "London".',
        inputSchema: z.object({
            city: z.string().describe('the city to get the weather for'),
        }),
        execute: async ({ city }) => {
            return ['Sunny', 'Rainy', 'Cloudy', 'Windy', 'Snowy'][Math.floor(Math.random() * 5)];
        }
    }),
    getCurrentTime: tool({
        description: 'Get the current time in a given timezone. Input should be a timezone like "Europe/Rome" or "America/New_York".',
        inputSchema: z.object({
            timezone: z.string().describe('the timezone to get the current time for'),
        }),
        execute: async ({ timezone }) => {
            return new Date().toLocaleString('en-US', { timeZone: timezone });
        }
    }),
    getRandomJoke: tool({
        description: 'Get a random joke.',
        inputSchema: z.object({}),
        execute: async () => {
            const jokes = [
                "Why don't skeletons fight each other? They don't have the guts.",
                "Why did the bicycle fall over? Because it was two-tired!",
                "I told my computer I needed a break, and it said 'No problem — I'll go to sleep.'",
                "Why did the scarecrow win an award? Because he was outstanding in his field!"
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }
    }),
    getRandomQuote: tool({
        description: 'Get a random inspirational quote.',
        inputSchema: z.object({}),
        execute: async () => {
            const quotes = [
                "The best way to get started is to quit talking and begin doing. - Walt Disney",
                "Don't let yesterday take up too much of today. - Will Rogers",
                "Success is not final, failure is not fatal: It is the courage to continue that counts. - Winston Churchill",
                "Do what you can with all you have, wherever you are. - Theodore Roosevelt"
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }
    }),
    getRandomNumber: tool({
        description: 'Get a random number between min and max.',
        inputSchema: z.object({
            min: z.number(),
            max: z.number(),
        }),
        execute: async ({ min, max }) => {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }),
    reverseString: tool({
        description: 'Reverse the input string.',
        inputSchema: z.object({
            text: z.string()
        }),
        execute: async ({ text }) => {
            return text.split('').reverse().join('');
        }
    }),
    capitalizeText: tool({
        description: 'Capitalize all words in a string.',
        inputSchema: z.object({
            text: z.string()
        }),
        execute: async ({ text }) => {
            return text.replace(/\b\w/g, c => c.toUpperCase());
        }
    }),
    getRandomColor: tool({
        description: 'Get a random hex color code.',
        inputSchema: z.object({}),
        execute: async () => {
            return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        }
    }),
    rollDice: tool({
        description: 'Roll a dice with the given number of sides.',
        inputSchema: z.object({
            sides: z.number().min(2)
        }),
        execute: async ({ sides }) => {
            return Math.floor(Math.random() * sides) + 1;
        }
    }),
    flipCoin: tool({
        description: 'Flip a coin and return "Heads" or "Tails".',
        inputSchema: z.object({}),
        execute: async () => {
            return Math.random() < 0.5 ? "Heads" : "Tails";
        }
    }),
    randomAnimal: tool({
        description: 'Return a random animal name.',
        inputSchema: z.object({}),
        execute: async () => {
            const animals = ['Cat', 'Dog', 'Elephant', 'Giraffe', 'Tiger', 'Penguin'];
            return animals[Math.floor(Math.random() * animals.length)];
        }
    }),
    simpleMath: tool({
        description: 'Perform a simple math operation (add, subtract, multiply, divide).',
        inputSchema: z.object({
            a: z.number(),
            b: z.number(),
            op: z.enum(['+', '-', '*', '/'])
        }),
        execute: async ({ a, b, op }) => {
            switch (op) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return b !== 0 ? a / b : 'Cannot divide by zero';
            }
        }
    }), 
    sendEmail: tool({
        description: 'Send an email. Input should include recipient, subject, and body.',
        inputSchema: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string()
        }),
        execute: async ({ to, subject, body }) => {
            await sleep(2); // simulate delay
            return `Email sent to ${to} with subject "${subject}"`;
        }
    })
};

export const therapyTool = tool({
    description: "This tool provides a list of personalized daily therapies for a user, indicating the medicine, day, and time of day it should be taken. Its output is a readable string listing the therapies to follow. It is intended only to test system behavior and does not contain real medical information.",
    inputSchema: z.object({}),
    execute: async () => {
        const therapy = [
            { medicine: 'OKI', day: 'oggi', time: 'pomeriggio' },
            { medicine: 'Aspirina', day: 'domani', time: 'mattina' }
        ];

        return therapy.map(t => `${t.medicine} da prendere ${t.day} ${t.time}`).join('; ');
    }
});


export const getDummyTools = (numTools: number) => {
    return Object.fromEntries(Object.entries(dummyTools).slice(0, numTools));
};
