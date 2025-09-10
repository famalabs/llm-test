from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from google import genai
from google.genai import types
from pydantic import BaseModel
from pydantic import Field
from time import sleep
import os
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"))

def evaluation_prompt(expected_answer=None, given_answer=None, query=None):
    
    all_defined = expected_answer is not None and given_answer is not None and query is not None
    
    prompt = f"""
You're an expert evaluator for assessing the correctness of answers provided by a question-answering system. Your task is to compare the provided answer with the expected answer and assign a correctness score based on the following criteria:
- Accuracy: Check if the given answer accurately reflects the information in the expected answer.
- Completeness: Determine if the given answer covers all necessary aspects of the expected answer.
- Relevance: Ensure that the given answer stays on topic and does not include extraneous information.

You will be given:
- A QUERY (the question asked).
- An EXPECTED ANSWER (the correct answer to the question).
- A GIVEN ANSWER (the answer provided by the system).

You're expected to provide:
1. A Correctness Score (0 to 1, in increments of 0.1).
2. A brief explanation (1-3 sentences) justifying your score.

Correctness Score (0 to 1, in increments of 0.1):
   0 = Completely Uncorrect: The provided answer doesn't match the expected answer.
   0.1 = Virtually Uncorrect: Barely related or mostly incorrect.
   0.2 = Very Slightly Uncorrect: Contains minor elements of correctness but mostly wrong.
   0.3 = Slightly Correct: Some relevant content but many errors or omissions.
   0.4 = Somewhat Correct: Partially correct but missing important details.
   0.5 = Moderately Correct: Halfway correct, some gaps or inaccuracies.
   0.6 = Fairly Correct: Mostly correct but missing minor points.
   0.7 = Correct: Correct with minor inaccuracies or omissions.
   0.8 = Very Correct: Mostly correct and complete, minor issues only.
   0.9 = Highly Correct: Almost perfect, negligible mistakes.
   1 = Perfectly Correct: Fully accurate, complete, and relevant.

Instructions:
1. Read the QUERY, EXPECTED ANSWER and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-1) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score.
"""

    if all_defined:
        prompt += f"""
-----------
QUERY:
{query}
-----------
EXPECTED ANSWER: 
{expected_answer}
-----------
GIVEN ANSWER:
{given_answer}
-----------
""".strip()
    return prompt

def g_eval(references, predictions, query):
    
    metric = GEval(
        name="Correctness",
        criteria=evaluation_prompt(),
        model="gpt-4o-mini",
        evaluation_params=[
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.EXPECTED_OUTPUT
        ]
    )

    scores = []
    for ref, pred in zip(references, predictions):
        test_case = LLMTestCase(
            input=query,
            actual_output=pred,
            expected_output=ref
        )
        metric.measure(test_case)
        scores.append(metric.score)

    return {"score": sum(scores) / len(scores)}

def llm_judge_custom(references, predictions, query):
    
    scores = []
    
    class EvalResult(BaseModel):
        score: float = Field(..., ge=0, le=1, description="Punteggio da 0 a 1")
        explanation: str = Field(..., description="Breve spiegazione del punteggio")
    
    for expected_answer, given_answer in zip(references, predictions):    
        
        print('Evaluating...')
        prompt = evaluation_prompt(expected_answer, given_answer, query)
        
        def get_response():
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': EvalResult
                }
            )
            return response
        
        try:
            response = get_response()
        except Exception as e:
            sleep(10)
            response = get_response()

        evaluation = response.parsed
        scores.append(evaluation.score)

    return {"score": sum(scores) / len(scores)}


METRICS = {
    'g_eval': {
        "function": g_eval,
        "result_key": 'score'
    }, 
    # 'llm_judge_custom': {
    #     "function": llm_judge_custom,
    #     "result_key": 'score'
    # }
}
