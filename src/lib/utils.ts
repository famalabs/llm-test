import { tool } from "ai";
import z from "zod";

export const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
export const dummyTools = {
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
                "Why did the bicycle fall over? Because it was two-tired!"
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
                "Don't let yesterday take up too much of today. - Will Rogers"
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }
    })
}