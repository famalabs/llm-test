from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from deepeval.models.base_model import DeepEvalBaseLLM
from pydantic import BaseModel
from time import sleep
from mistralai import Mistral
import instructor
import os

mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

class CustomMistral(DeepEvalBaseLLM):
    def __init__(self, llm):
        self.model = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
        self.llm = llm

    def load_model(self):
        return self.model

    def generate(self, prompt: str, schema: BaseModel) -> str:
        client = self.load_model()
        instructor_client = instructor.from_mistral(
            client=client,
            mode=instructor.Mode.MISTRAL_STRUCTURED_OUTPUTS
        )
        respo = instructor_client.messages.create(
            model=self.llm,
            messages=[
                { 'role' : 'user', 'content' : prompt }
            ],
            response_model=schema
        )
        return respo

    async def a_generate(self, prompt: str, schema: BaseModel) -> BaseModel:
        return self.generate(prompt, schema)

    def get_model_name(self):
        return "Custom Mistral Model"

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

def g_eval(references, predictions, query, llm):
    model = CustomMistral(llm)
    metric = GEval(
        name="Correctness",
        criteria=evaluation_prompt(),
        model=model,
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

def llm_judge_custom(references, predictions, query, llm, prompt_funct=evaluation_prompt):
    
    scores = []
    
    class EvalResult(BaseModel):
        score: float
        explanation: str
    
    for expected_answer, given_answer in zip(references, predictions):    
        
        print('Evaluating...')
        prompt = prompt_funct(expected_answer, given_answer, query)
        
        def get_response():
            response = mistral_client.chat.parse(
                temperature=0, 
                model=llm,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                response_format=EvalResult
            )

            return response
        
        try:
            response = get_response()
        except Exception:
            sleep(10)
            response = get_response()

        evaluation = response.choices[0].message.parsed
        scores.append(evaluation.score)

    return {"score": sum(scores) / len(scores)}

def llm_judge_custom_small(references, predictions, query):
    return llm_judge_custom(references, predictions, query, llm="mistral-small-latest")

def llm_judge_custom_medium(references, predictions, query):
    return llm_judge_custom(references, predictions, query, llm="mistral-medium-latest")

def llm_judge_custom_large(references, predictions, query):
    return llm_judge_custom(references, predictions, query, llm="mistral-large-latest")

def g_eval_small(references, predictions, query):
    return g_eval(references, predictions, query, llm="mistral-small-latest")

def g_eval_medium(references, predictions, query):
    return g_eval(references, predictions, query, llm="mistral-medium-latest")

def g_eval_large(references, predictions, query):
    return g_eval(references, predictions, query, llm="mistral-large-latest")

METRICS = {
    'g_eval_small': {
        "function": g_eval_small,
        "result_key": 'score'
    },
    'g_eval_medium': {
        "function": g_eval_medium,
        "result_key": 'score'
    },
    'g_eval_large': {
        "function": g_eval_large,
        "result_key": 'score'
    },
    'llm_judge_custom_small': {
        "function": llm_judge_custom_small,
        "result_key": 'score'
    },
    'llm_judge_custom_medium': {
        "function": llm_judge_custom_medium,
        "result_key": 'score'
    },
    'llm_judge_custom_large': {
        "function": llm_judge_custom_large,
        "result_key": 'score'
    },
}
