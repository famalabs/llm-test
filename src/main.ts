import { writeFile } from 'fs/promises';
import { LLMConfig, LLMConfigProvider } from './llm';
import { createOutputFolderIfNeeded, getUserInput } from './utils';
import { Lmr, LmrOutput } from './lmr';
import { Lma, LmaInput, LmaOutput, InputTask } from './lma';
import { lmrToolbox } from './lmr/lmr.tools';
import { TaskDue, LmrInput } from './lmr/interfaces';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import yargs from 'yargs';

global.AI_SDK_LOG_WARNINGS = false;

const MODEL_PROVIDER = {
    model: 'gpt-4.1-mini',
    provider: 'openai' as LLMConfigProvider,
}
const LMR_STYLE = 'Joyful (talk as you\'re happy)';
const LMR_TASKS: InputTask[] = [
    { name: "heart-rate", type: "number", description: "The heart rate of the patient, measured in beats per minute." },
    { name: "paracetamol", type: "boolean", description: "The patient must assume 500 mg of paracetamol." },
    { name: "strange-feelings", type: "string", description: "The patient must tell whether they are experiencing any strange feelings." }
];

type AugmentedLmaOutput = LmaOutput & ({ aPrioriGate?: { task_interaction: boolean, user_request: boolean } });
type SessionEntry = { lmrOutput?: LmrOutput, lmaOutput?: AugmentedLmaOutput, userInput?: string, lmrInput?: LmrInput, lmaInput?: LmaInput, lmrLatencyMs?: number, lmaLatencyMs?: number };
class SessionRec {
    private logFilePath: string;
    private data: { config: { llmConfig: LLMConfig, lmrTasks: InputTask[], lmrStyle: string }, session: SessionEntry[] };
    constructor() {
        this.logFilePath = path.join(
            createOutputFolderIfNeeded('output', 'lm-ar'),
            'session-' + Date.now() + '.json'
        );
        this.data = {
            config: {
                llmConfig: MODEL_PROVIDER,
                lmrStyle: LMR_STYLE,
                lmrTasks: LMR_TASKS
            },
            session: []
        }
    }
    async registerStep({ lmrOutput, lmaOutput, userInput, lmaInput, lmrInput, lmrLatencyMs, lmaLatencyMs }: SessionEntry) {
        const internalLmrInput = lmrInput ? { ...lmrInput } : undefined;
        if (internalLmrInput) delete internalLmrInput.tools;
        this.data.session.push({ lmrOutput, lmaOutput, userInput, lmaInput, lmrInput: internalLmrInput, lmrLatencyMs, lmaLatencyMs });
        await writeFile(this.logFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}

const logAgentMessage = (lmrOutput: LmrOutput) => {
    const toolCalls = lmrOutput.metadata?.tool_calls || [];
    const source = toolCalls.length > 0
        ? toolCalls.map(tc => tc.toolName).join(', ')
        : 'Agent';

    console.log(`\nAGENT [ Source = ${source} ]: ${lmrOutput.agent_message}\n`);
}

const logLmaOutput = (lmaOutput: AugmentedLmaOutput) => {
    let str = '\n\t[ Lma Output ]\n';
    if (lmaOutput.aPrioriGate) {
        str += '\t\t { A priori Gate }\n';
        str += '\t\t\t task_interaction = ' + lmaOutput.aPrioriGate.task_interaction + '\n';
        str += '\t\t\t user_request = ' + lmaOutput.aPrioriGate.user_request + '\n';
    }
    str += '\t\t user_request = ' + lmaOutput.user_request + '\n';
    str += '\t\t task = ' + (lmaOutput.task ? `(status = ${lmaOutput.task?.status}, answer = ${lmaOutput.task?.answer})` : 'null') + '\n';
    console.log(str + '\n');
}

const lma = new Lma({ baseConfig: { ...MODEL_PROVIDER, parallel: true } });
const lmr = new Lmr({ baseConfig: { ...MODEL_PROVIDER } });

const main = async () => {

    const { skipSentimentAnalysis, debug } = await yargs(hideBin(process.argv))
        .option('skip-sentiment-analysis', {
            alias: 'ssa',
            type: 'boolean',
            description: 'Skip sentiment analysis in LMA processing',
            default: false
        })
        .option('debug', { alias: 'd', type: 'boolean', description: 'If true, you see LMA output during conversation', default: false })
        .help()
        .parse() as { skipSentimentAnalysis: boolean, debug: boolean };

    const session = new SessionRec();

    console.log('--- Saving session to', session.getLogFilePath(), '---');

    let currentTaskIndex = 0;
    const taskFlags: Record<number, { ignored?: boolean; waited?: boolean }> = {};
    let summary: LmaInput['summary'] = undefined;
    let pendingRequest = false;

    const hasPendingTasks = () => currentTaskIndex < LMR_TASKS.length;

    const currentTaskDue = (): TaskDue | null => {
        if (!hasPendingTasks()) return null;
        const t = LMR_TASKS[currentTaskIndex];
        const flags = taskFlags[currentTaskIndex] || {};
        return { name: t.name, description: t.description, ...flags };
    };

    const openingInput: LmrInput = {
        chat_status: 'open',
        style: LMR_STYLE,
        history: [],
        task_due: currentTaskDue(),
    };

    const lmrStartTime = performance.now();
    const openingMessage = await lmr.mainCall(openingInput);
    const lmrEndTime = performance.now();

    await session.registerStep({ lmrInput: openingInput, lmrOutput: openingMessage, lmrLatencyMs: lmrEndTime - lmrStartTime });

    const messages: { sender: 'agent' | 'user', message: string }[] = [
        { sender: 'agent', message: openingMessage.agent_message }
    ];

    logAgentMessage(openingMessage);

    const requestDetectionMode = lma.getConfig().userRequestConfig.requestDetection.mode;

    while (true) {
        const userMsg = await getUserInput('USER: ');
        messages.push({ sender: 'user', message: userMsg });

        const chatStatusForLma: LmaInput['chat_status'] = pendingRequest
            ? 'request'
            : hasPendingTasks() ? 'normal' : 'close';

        const currentFlags = taskFlags[currentTaskIndex] || {};
        const shouldIncludeTaskInLma = hasPendingTasks() && (
            chatStatusForLma != 'request' ||
            !!(currentFlags.ignored || currentFlags.waited)
        );

        const lmaInput: LmaInput = {
            message: userMsg,
            chat_status: chatStatusForLma,
            history: [...messages],
            summary: summary ?? undefined,
            task: shouldIncludeTaskInLma ? LMR_TASKS[currentTaskIndex] : undefined,
        };

        const lmaStartTime = performance.now();
        const aPrioriGate = await lma.aPrioriClassification(lmaInput);

        if (hasPendingTasks() && !aPrioriGate.task_interaction) {
            taskFlags[currentTaskIndex] = { ignored: true };
        }

        const skipTaskAnalysis = !aPrioriGate.task_interaction;
        const skipUserRequestDetection = !aPrioriGate.user_request;

        const lmaOutput = await lma.mainCall(lmaInput, { skipSentimentAnalysis, skipTaskAnalysis, skipUserRequestDetection });
        const lmaEndTime = performance.now();

        if (debug) { logLmaOutput({...lmaOutput, aPrioriGate }); }

        if (lmaOutput.summary) {
            summary = lmaOutput.summary;
        }

        if (aPrioriGate.task_interaction && lmaOutput.task && hasPendingTasks()) {
            const status = lmaOutput.task.status;

            if (status == 'answered') { // we can move on
                currentTaskIndex += 1;
            }
            else if (status == 'negated') {
                console.warn('[!] CURRENT TASK NEGATED. Moving to next task.');
                currentTaskIndex += 1;
            }
            else if (status == 'ignored') {
                taskFlags[currentTaskIndex] = { ignored: true };
            }
            else if (status == 'wait') {
                taskFlags[currentTaskIndex] = { waited: true };
            }
        }

        pendingRequest = aPrioriGate.user_request; 

        const chatStatusForLmr: LmrInput['chat_status'] = pendingRequest
            ? 'request'
            : (
                hasPendingTasks()
                    ? 'normal'
                    : 'close'
            );


        let lmrTools: typeof lmrToolbox | undefined;

        if (chatStatusForLmr == 'request') {
            if (requestDetectionMode == 'simple') {
                lmrTools = lmrToolbox;
            }
            else {
                const useful = lmaOutput.useful_tools || [];
                const filtered: Partial<typeof lmrToolbox> = {};
                for (const { name } of useful) {
                    const tool = lmrToolbox[name as keyof typeof lmrToolbox];
                    if (tool) {
                        filtered[name as keyof typeof lmrToolbox] = tool as any;
                    }
                    else {
                        console.warn(`[!] Useful tool "${name}" not found in LMR toolbox.`);
                    }
                }
                if (Object.keys(filtered).length > 0) {
                    lmrTools = filtered as typeof lmrToolbox;
                }
            }
        }

        const lmrInput: LmrInput = {
            chat_status: chatStatusForLmr,
            style: LMR_STYLE,
            history: [...messages],
            summary: summary ?? undefined,
            user_request: chatStatusForLmr == 'request' ? (lmaOutput.user_request || undefined) : undefined,
            task_due: chatStatusForLmr != 'request' ? currentTaskDue() : undefined,
        };

        if (lmrTools) {
            lmrInput.tools = lmrTools;
        }

        const lmrStartTime = performance.now();
        const lmrOutput = await lmr.mainCall(lmrInput);
        const lmrEndTime = performance.now();

        messages.push({ sender: 'agent', message: lmrOutput.agent_message });
        logAgentMessage(lmrOutput);

        await session.registerStep({
            userInput: userMsg,
            lmaInput,
            lmaOutput: { ...lmaOutput, aPrioriGate },
            lmrInput,
            lmrOutput,
            lmrLatencyMs: lmrEndTime - lmrStartTime,
            lmaLatencyMs: lmaEndTime - lmaStartTime
        });

        if (chatStatusForLmr == 'close') break;
    }

    console.log('\n\n Session saved to', session.getLogFilePath());
}

main().catch(console.error).then(() => process.exit());