import { writeFile } from 'fs/promises';
import { LLMConfig, LLMConfigProvider } from './llm';
import { createOutputFolderIfNeeded, getUserInput } from './utils';
import { Lmr, LmrOutput } from './lmr';
import { Lma, LmaInput, LmaOutput, InputTask } from './lma';
import { exampleLmrTools } from './lmr/lmr.tools';
import { TaskDue, LmrInput } from './lmr/interfaces';
import path from 'path';

const MODEL_PROVIDER = {
    model: 'gpt-4.1-mini',
    provider: 'openai' as LLMConfigProvider,
}
const LMR_STYLE = 'Joyful';
const LMR_TASKS: InputTask[] = [
    { name: "heart-rate", type: "number", description: "The heart rate of the patient, measured in beats per minute." },
    { name: "paracetamol", type: "boolean", description: "The patient must assume 500 mg of paracetamol." },
    { name: "strange-feelings", type: "string", description: "The patient must tell whether they are experiencing any strange feelings." }
];

type SessionEntry = { lmrOutput?: LmrOutput, lmaOutput?: LmaOutput, userInput?: string, lmrInput?: LmrInput, lmaInput?: LmaInput, lmrLatencyMs?: number, lmaLatencyMs?: number };
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
            session :[]
        }
    }
    async registerStep({ lmrOutput, lmaOutput, userInput, lmaInput, lmrInput, lmrLatencyMs, lmaLatencyMs }: SessionEntry) {
        const internalLmrInput = lmrInput ? { ...lmrInput } : undefined;
        if (internalLmrInput) delete internalLmrInput.tools;
        this.data.session.push({ lmrOutput, lmaOutput, userInput, lmaInput, lmrInput: internalLmrInput, lmrLatencyMs, lmaLatencyMs });
        await writeFile(this.logFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
    }
}

const lma = new Lma({ baseConfig: { ...MODEL_PROVIDER, parallel: true } });
const lmr = new Lmr({ baseConfig: { ...MODEL_PROVIDER } });

const main = async () => {

    const session = new SessionRec();

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

    console.log('AGENT:', openingMessage.agent_message, '\n');

    const requestDetectionMode = lma.getConfig().userRequestConfig.requestDetection.mode;

    while (true) {
        const userMsg = await getUserInput('USER: ');
        messages.push({ sender: 'user', message: userMsg });

        const chatStatusForLma: LmaInput['chat_status'] = pendingRequest
            ? 'request'
            : hasPendingTasks() ? 'normal' : 'close';

        const lmaInput: LmaInput = {
            message: userMsg,
            chat_status: chatStatusForLma,
            history: messages,
            summary: summary ?? undefined,
            task: hasPendingTasks() ? LMR_TASKS[currentTaskIndex] : undefined,
        };

        const lmaStartTime = performance.now();
        const lmaOutput = await lma.mainCall(lmaInput);
        const lmaEndTime = performance.now();

        if (lmaOutput.summary) {
            summary = lmaOutput.summary;
        }


        if (lmaOutput.task && hasPendingTasks()) {
            const status = lmaOutput.task.status;

            if (status == 'answered') { // we can move on
                currentTaskIndex += 1;
            }
            else if (status == 'negated') {
                console.warn('[!] CURRENT TASK NEGATED. Moving to next task.');
                currentTaskIndex += 1;
            }
            else if (status == 'ignored') {
                taskFlags[currentTaskIndex] = { ...(taskFlags[currentTaskIndex] || {}), ignored: true };
            }
            else if (status == 'wait') {
                taskFlags[currentTaskIndex] = { ...(taskFlags[currentTaskIndex] || {}), waited: true };
            }
        }

        const hasUserReq = !!(lmaOutput.user_request);
        const reqSatisfied = lmaOutput.request_satisfied == true;
        pendingRequest = hasUserReq && !reqSatisfied;

        const chatStatusForLmr: LmrInput['chat_status'] = pendingRequest
            ? 'request'
            : (
                hasPendingTasks()
                    ? 'normal'
                    : 'close'
            );


        let lmrTools: typeof exampleLmrTools | undefined;

        if (chatStatusForLmr == 'request') {
            if (requestDetectionMode == 'simple') {
                lmrTools = exampleLmrTools;
            }
            else {
                const useful = lmaOutput.useful_tools || [];
                const filtered: Partial<typeof exampleLmrTools> = {};
                for (const { name } of useful) {
                    const tool = exampleLmrTools[name as keyof typeof exampleLmrTools];
                    if (tool) {
                        filtered[name as keyof typeof exampleLmrTools] = tool as any;
                    }
                    else {
                        console.warn(`[!] Useful tool "${name}" not found in LMR toolbox.`);
                    }
                }
                if (Object.keys(filtered).length > 0) {
                    lmrTools = filtered as typeof exampleLmrTools;
                }
            }
        }

        const lmrInput: LmrInput = {
            chat_status: chatStatusForLmr,
            style: LMR_STYLE,
            history: messages,
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
        console.log('AGENT:', lmrOutput.agent_message, '\n');

        await session.registerStep({
            userInput: userMsg,
            lmaInput,
            lmaOutput,
            lmrInput,
            lmrOutput,
            lmrLatencyMs: lmrEndTime - lmrStartTime,
            lmaLatencyMs: lmaEndTime - lmaStartTime
        });

        if (chatStatusForLmr == 'close') break;
    }
}

main().catch(console.error).then(() => process.exit());