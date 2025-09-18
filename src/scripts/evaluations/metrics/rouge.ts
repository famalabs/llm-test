import { n as rougeN } from 'js-rouge';
import { Metric, MetricArguments } from './interfaces';

const execute =  async ({ reference, prediction }: MetricArguments) => ({ score: await rougeN(prediction, reference, { n : 1}) });

export const rouge1: Metric = {
    name: 'rouge1',
    execute
};