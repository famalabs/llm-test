PROMPT_CONFIGS = {
        "llm_full": {
            "task_description": "Your task is to compare the provided answer with two answers: One contains only key informations, the other contains both key and optional informations.",
            "expected_output": """1. A Correctness Score (0 to 1, in increments of 0.1).
2. A brief explanation (1-3 sentences) justifying your score.""",
            "score_criteria": """Correctness Score (0 to 1, in increments of 0.1):
    0 = Incorrect or fabricated information (regardless of the presence of key or optional information)
    0.1 = Absence of both key and optional information (generic information without informative content)
    0.2 = Absence of key information but contains some optional information
    0.3 = Many key pieces of information are missing and many or all optional pieces are missing
    0.4 = Many key pieces of information are missing but contains all or almost all optional pieces
    0.5 = A few key pieces of information are missing and many or all optional pieces are missing
    0.6 = A few key pieces of information are missing but contains all or almost all optional pieces
    0.7 = All and only the key pieces of information
    0.8 = All key pieces of information and a few optional pieces
    0.9 = All key pieces of information and many optional pieces
    1 = All key pieces of information and all optional pieces""",
            "instructions": """1. Read the QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED ANSWERS based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-1) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score."""
        },
        "llm_main": {
            "task_description": "Your task is to compare the provided answer with the answer containing only key informations.",
            "expected_output": """You're expected to compare only the GIVEN ANSWER against the EXPECTED KEY ANSWER, using the QUERY and the EXPECTED FULL ANSWER just for the context.

You're expected to provide:
1. A Correctness Score (0 to 4, in increments of 1) comparing the QUERY with the EXPECTED KEY ANSWER (the EXPECTED FULL ANSWER must be used just for the context).
2. A brief explanation (1-3 sentences) justifying your score.""",
            "score_criteria": """Correctness Score (0 to 4, in increments of 1):
    0 = Incorrect or fabricated information (regardless of the presence of key or optional information)
    1 = Absence of key information (generic information without informative content)
    2 = Somewhere between 0% and 50% of key pieces of information are present.
    3 = Somewhere between 50% and 100% of key pieces of information are present.
    4 = All key pieces of information are present.""",
            "instructions": """1. Read the QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED KEY ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-4) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score."""
        },
        "llm_sub": {
            "task_description": "Your task is to compare the provided answer with the answer containing both key and optional informations.",
            "expected_output": """You're expected to compare only the GIVEN ANSWER against the EXPECTED FULL ANSWER.
You're expected to provide:
1. A Correctness Score (0 to 4, in increments of 1).
2. A brief explanation (1-3 sentences) justifying your score.""",
            "score_criteria": """Correctness Score (0 to 4, in increments of 1):
    0 = Incorrect or fabricated information (regardless of the presence of key or optional information)
    1 = Absence of both key and optional information (generic information without informative content)
    2 = Somewhere between 0% and 50% of key pieces of information are present.
    3 = Somewhere between 50% and 100% of key pieces of information are present.
    4 = All key pieces of information and all optional pieces are present.""",
            "instructions": """1. Read the QUERY, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED FULL ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-4) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score."""
        },
        "llm_main_sub": {
            "task_description": """Your task is to compare the provided answer with BOTH:
- The answer containing only key information (EXPECTED KEY ANSWER).
- The answer containing both key and optional information (EXPECTED FULL ANSWER).""",
            "expected_output": """You're expected to provide:
1. TWO Correctness Scores (0 to 4, in increments of 1): 
    * The first score is based on comparison with the EXPECTED KEY ANSWER.
    * The second score is based on comparison with the EXPECTED FULL ANSWER.
2. A brief explanation (1-3 sentences) justifying both scores.""",
            "score_criteria": """Correctness Score (0 to 4, in increments of 1):
    0 = Incorrect or fabricated information (regardless of the presence of key or optional information)
    1 = Absence of the relevant information (generic information without informative content)
    2 = Somewhere between 0% and 50% of the relevant information is present.
    3 = Somewhere between 50% and 100% of the relevant information is present.
    4 = All relevant information is present (for key-only: all key points; for full: all key and optional points).""",
            "instructions": """1. Read the QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. First, evaluate the GIVEN ANSWER against the EXPECTED KEY ANSWER and assign the first Correctness Score (0-4).
3. Then, evaluate the GIVEN ANSWER against the EXPECTED FULL ANSWER and assign the second Correctness Score (0-4).
4. Provide a single explanation (1-3 sentences) that justifies both scores, clearly referring to the key-only comparison and the full-answer comparison."""
        }
    }


def build_prompt(type, query, expected_key_answer, expected_full_answer, provided_answer):
    if type not in PROMPT_CONFIGS:
        raise ValueError(f"Unknown prompt type: {type}")

    if type in ["llm_full", "llm_main_sub"] and (expected_key_answer is None or expected_full_answer is None):
        raise ValueError(f"expected_key_answer and expected_full_answer must be provided for '{type}' prompt type.")
    if type == "llm_sub" and expected_full_answer is None:
        raise ValueError(f"expected_full_answer must be provided for 'sub' prompt type.")

    config = PROMPT_CONFIGS[type]

    input_blocks = [f"QUERY:```\n{query}\n```"]
    if type in ["llm_full", "llm_main", "llm_main_sub"]:
        input_blocks.append(f"EXPECTED KEY ANSWER:```\n{expected_key_answer}\n```")
    if type == "llm_main":
        input_blocks.append(f"EXPECTED FULL ANSWER (just for context):```\n{expected_full_answer}\n```")
    elif type in ["llm_full", "llm_sub", "llm_main_sub"]:
        input_blocks.append(f"EXPECTED FULL ANSWER:```\n{expected_full_answer}\n```")

    input_blocks.append(f"GIVEN ANSWER:```\n{provided_answer}\n```")
    
    prompt_template = f"""
You're an expert evaluator for assessing the correctness of answers provided by a question-answering system. 
{config['task_description']}
Considering also the query, you will assign a correctness score based on the following criteria:
- Accuracy: Check if the given answer accurately reflects the information in the expected answers without introducing any false or misleading information.
- Completeness: Determine if the given answer covers all key points from the expected answer(s).
- Relevance: Ensure that the given answer stays on topic and does not include extraneous information.

{config['expected_output']}

{config['score_criteria']}

Instructions:
{config['instructions']}

{''.join(input_blocks)}
""".strip()

    return prompt_template