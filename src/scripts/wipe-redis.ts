import Redis from "ioredis"

export const main = async () => {
    const client = new Redis(process.env.REDIS_URL!);
    await client.flushall();
    console.log('Redis database wiped');
     client.disconnect();
}


main().catch(console.error).then(_ => process.exit(0));
