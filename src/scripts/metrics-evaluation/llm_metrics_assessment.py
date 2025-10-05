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
from openai import OpenAI
load_dotenv('.env')

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

def main():

    metrics_tests = load_metrics_tests()
    metrics_results = defaultdict(list)
    metrics_meta = {}
    llm_sub_zero_set = set()
    merge_main_sub = "--merge-main-sub" in sys.argv
    
    # we have to get -m model and -p provider from command line args
    # e.g. python llm_metrics_assessment.py -m gpt-5 -p openai
    if "-m" in sys.argv:
        model_index = sys.argv.index("-m") + 1
        model_name = sys.argv[model_index]
        print(f"Using model: {model_name}")
    else:
        raise ValueError("Model name must be specified with -m argument") 
        
    if "-p" in sys.argv:
        provider_index = sys.argv.index("-p") + 1
        provider_name = sys.argv[provider_index]
        print(f"Using provider: {provider_name}")
    else:
        raise ValueError("Provider name must be specified with -p argument")
        
    if "-v" in sys.argv:
        version_index = sys.argv.index("-v") + 1
        version = sys.argv[version_index]
        print(f"Using version: {version}")
    else:
        raise ValueError("Version must be specified with -v argument")

    METRICS = ['llm_full', 'llm_main', 'llm_sub']

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

            if metric_type == 'llm_sub':
                if provided_answer in llm_sub_zero_set:
                    print('Skipping LLM Sub evaluation for answer that got 0 in LLM Main:', provided_answer)
                    raw_scores.append(0)
                    continue

            prompt = build_prompt(metric_type, query, key_ref, full_ref, provided_answer)
            
            class EvalResult(BaseModel):
                score: float
                explanation: str

            class EvalResultLLMMainSub(BaseModel):
                score_main: float
                score_sub: float
                explanation: str
            
            if provider_name == 'openai':
                response = openai_client.chat.completions.parse(
                    model=model_name,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    response_format=EvalResult if metric_type != 'llm_main_sub' else EvalResultLLMMainSub
                )
            elif provider_name == 'mistral':
                response = mistral_client.chat.parse(
                    model=model_name,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    response_format=EvalResult if metric_type != 'llm_main_sub' else EvalResultLLMMainSub
                )
                
            evaluation = response.choices[0].message.parsed

            if metric_type != 'llm_main_sub':
                score = evaluation.score
                raw_scores.append(score)
                if metric_type == 'llm_main' and score == 0:
                    print('Adding to LLM Sub zero set:', provided_answer)
                    llm_sub_zero_set.add(provided_answer)

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

    base_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
    output_dir = os.path.normpath(os.path.join(base_dir, 'output', 'evaluations', 'metrics', 'v2'))
    os.makedirs(output_dir, exist_ok=True)
    results_path = os.path.normpath(os.path.join(output_dir, f'results{"-main-sub-merged" if merge_main_sub else ""}-{model_name}-{provider_name}-v={version}-llm.json'))
    with open(results_path, 'w') as f:
        json.dump({"metrics": metrics_results, "meta": metrics_meta}, f, indent=4)
    
    print(f"Output written to {results_path}")
    
    if sys.platform == "darwin":
        cmd = 'say "Valutazione conclusa"'
        os.system(cmd)

if __name__ == "__main__":
    main()
