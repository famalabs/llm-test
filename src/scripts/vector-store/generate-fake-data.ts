import { faker } from '@faker-js/faker';
import { existsSync, mkdirSync } from 'fs';
import yargs from 'yargs';
import { writeFile } from 'fs/promises';
import { createOutputFolderIfNeeded } from '../../lib/utils';
import { hideBin } from 'yargs/helpers';


const docTypes = ['therapy_plan', 'log', 'faq', 'instruction', 'chat_summary'];
const version = [1,2,3];
const randomSelect = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

const getRandomDateInPast6Months = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const getRandomChunk = () => {
    const sample = Math.random();
    // 20% small (5 paragraphs)
    // 70% medium (20 paragraphs)
    // 10% large (50 paragraphs)
    if (sample < 0.2) return faker.lorem.paragraphs(5, '\n\n');
    if (sample < 0.9) return faker.lorem.paragraphs(20, '\n\n');
    return faker.lorem.paragraphs(50, '\n\n');
}

const main = async () => {
    const { scale } = await yargs(hideBin(process.argv))
        .option('scale', { alias: 's', choices: ['xs', 's', 'm', 'l'], demandOption: true, type: 'string', description: 'Data size: xs|s|m|l' })
        .help()
        .parse();

    let numPatients = 100;
    if (scale === 's') numPatients = 1_000;
    if (scale === 'm') numPatients = 10_000;
    if (scale === 'l') numPatients = 100_000;

    const scaleName : Record<string, string> = {
        xs: 'extra-small',
        s: 'small',
        m: 'medium',
        l: 'large',
    }

    const fileName = `${createOutputFolderIfNeeded('output/vector-store/fake-data')}/fake-patients-data-${scaleName[scale!]}.json`;
    const patients = [];
    for (let i = 0; i < numPatients; i++) {
        const metadata = {
            patient_id: faker.string.uuid(),
            doc_type: randomSelect(docTypes),
            date: getRandomDateInPast6Months(),
            version: randomSelect(version),
            source: randomSelect(['manual', 'uploaded', 'global_knowledge']),
        };
        const chunk = getRandomChunk();
        patients.push({ metadata, chunk });
    }
    await writeFile(fileName, JSON.stringify(patients, null, 2));
    console.log(`Generated ${numPatients} patients data and saved to ${fileName}`);
}

main().catch(console.error).then(_ => process.exit(0)); 