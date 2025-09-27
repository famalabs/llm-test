from metrics_assessment import compute_best_threshold
from mistralai import Mistral
from lib.data_loader import load_metrics_tests
from lib.llm_metrics_prompts import build_prompt
from collections import defaultdict
from pydantic import BaseModel
from tqdm import tqdm
import os
import json
import sys
from dotenv import load_dotenv
load_dotenv('.env')

mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

def main():

    metrics_tests = load_metrics_tests()
    metrics_results = defaultdict(list)
    metrics_meta = {}
    merge_main_sub = "--merge-main-sub" in sys.argv
    
    print(f"Merge main and sub categories: {merge_main_sub}")

    METRICS = ['llm_full', 'llm_sub', 'llm_main']

    for metric in tqdm(METRICS):
    
        if merge_main_sub and metric == 'llm_sub':
            print(f"Skipping {metric} because --merge-main-sub is set")
            continue
            
        batch_data = []
        for group_name, tests in metrics_tests.items():
            question_test = tests['Test']
            key_ref = tests['KeyRef']
            full_ref = tests['FullRef']
            answer_candidates = tests['Candidates']
            main_cat = tests.get('MainCategory')
            sub_cat = tests.get('SubCategory')
                
            for candidate in answer_candidates:
                    batch_data.append({
                    'group_name': group_name,
                    'question_test': question_test,
                    'key_ref': key_ref,
                    'full_ref': full_ref,
                    'candidate': candidate,
                    'main_cat': main_cat,
                    'sub_cat': sub_cat
                })


        raw_scores = []
        raw_scores_two = []

        for item in batch_data:

            metric_type = 'llm_main_sub' if (metric == 'llm_main' and merge_main_sub) else metric

            query = item['question_test']
            key_ref = item['key_ref']
            full_ref = item['full_ref']
            provided_answer = item['candidate']['Candidate']

            prompt = build_prompt(metric_type, query, key_ref, full_ref, provided_answer)

            class EvalResult(BaseModel):
                score: float
                explanation: str

            class EvalResultLLMMainSub(BaseModel):
                score_main: float
                score_sub: float
                explanation: str
            
            response = mistral_client.chat.parse(
                temperature=0, 
                model='mistral-small-latest',
                messages=[
                    {"role": "user", "content": prompt}
                ],
                response_format=EvalResult if metric_type != 'llm_main_sub' else EvalResultLLMMainSub
            )

            evaluation = response.choices[0].message.parsed

            if metric_type != 'llm_main_sub':
                score = evaluation.score
                raw_scores.append(score)

            if metric_type == 'llm_main_sub':
                raw_scores.append(evaluation.score_main)
                raw_scores_two.append(evaluation.score_sub)

            
        def store_in_metrics_results(_raw_scores, _metric):
            expected_binaries = [item['candidate']['Binary'] for item in batch_data]
            threshold, best_f1 = compute_best_threshold(_raw_scores, expected_binaries)

            metrics_meta[_metric] = {
                "threshold": threshold,
                "best_f1": best_f1,
            }

            for item, rf in zip(batch_data, _raw_scores):
                candidate = item['candidate']
                binary_pred = None
                if candidate['Binary'] is not None:
                    binary_pred = int(rf >= threshold) if rf is not None else None

                metrics_results[_metric].append({
                    "group": item['group_name'],
                    "test": item['question_test'],
                    "main_category": item['main_cat'],
                    "sub_category": item['sub_cat'],
                    "candidate": candidate['Candidate'],
                    "expected_continuous": candidate['Continuous'],
                    "expected_binary": candidate['Binary'],
                    "result_continuous": rf,
                    "result_binary": binary_pred,
                    "threshold": threshold,
                })
        if merge_main_sub and metric != 'llm_full':
            store_in_metrics_results(raw_scores, 'llm_main')
            store_in_metrics_results(raw_scores_two, 'llm_sub')
        else:
            store_in_metrics_results(raw_scores, metric)

    os.makedirs('output/evaluations/metrics/v2', exist_ok=True)
    with open(f'output/evaluations/metrics/v2/results{"-main-sub-merged" if merge_main_sub else ""}-llm.json', 'w') as f:
        json.dump({"metrics": metrics_results, "meta": metrics_meta}, f, indent=4)

if __name__ == "__main__":
    main()
