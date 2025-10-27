import { LmaOutput } from "../interfaces";

export const evaluateToolsDetection = ({
    expectedOutputs,
    generatedOutputs
}: {
    expectedOutputs: LmaOutput[],
    generatedOutputs: LmaOutput[]
}) => {
    let totalSamples = 0;
    let totalIoU = 0;
    let totalParamAccuracy = 0;
    let totalParamSamples = 0;

    for (let i = 0; i < expectedOutputs.length; i++) {
        const expected = expectedOutputs[i].useful_tools || [];
        const generated = generatedOutputs[i].useful_tools || [];

        if (expected.length == 0 && generated.length == 0) continue;

        totalSamples += 1;

        const expectedNames = expected.map(t => t.name);
        const generatedNames = generated.map(t => t.name);

        const intersection = expectedNames.filter(name => generatedNames.includes(name));
        const union = [...new Set([...expectedNames, ...generatedNames])];
        const iou = union.length == 0 ? 0 : intersection.length / union.length;
        totalIoU += iou;

        for (const toolName of intersection) {
            const expectedTool = expected.find(t => t.name == toolName);
            const generatedTool = generated.find(t => t.name == toolName);

            if (!expectedTool?.parameters && !generatedTool?.parameters) {
                // correct
                totalParamAccuracy += 1;
                totalParamSamples += 1;
                continue;
            }

            if (expectedTool?.parameters && generatedTool?.parameters) {

                const expectedParams = expectedTool.parameters;
                const generatedParams = generatedTool.parameters;
                const paramKeys = new Set([...Object.keys(expectedParams), ...Object.keys(generatedParams)]);
                let correct = 0;
                let total = 0;

                for (const key of paramKeys) {
                    const expVal = expectedParams[key];
                    const genVal = generatedParams[key];
                    if (expVal != undefined && genVal != undefined) {
                        total++;
                        const isEqual = typeof expVal == 'string' && typeof genVal == 'string'
                            ? expVal.toLowerCase().trim() == genVal.toLowerCase().trim()
                            : expVal == genVal;
                        if (isEqual) correct++;
                    }
                }

                if (total > 0) {
                    totalParamAccuracy += correct / total;
                    totalParamSamples += 1;
                }
            }
        }
    }

    const averageIoU = totalSamples == 0 ? null : totalIoU / totalSamples;
    const averageParamAccuracy = totalParamSamples == 0 ? null : totalParamAccuracy / totalParamSamples;

    return {
        toolNameIoU: averageIoU,
        toolParamAccuracy: averageParamAccuracy
    };
};
