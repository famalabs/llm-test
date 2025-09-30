# Reinforced attention on 0

shallower_reinforcement_on_0 = """Remember: If the given answer include false information, its score is 0."""
reinforced_attention_on_0 = """Be meticoulous and check every detail of the GIVEN ANSWER. Even a small mistake or omission w.r.t. the EXPECTED ANSWERS lead to a score of 0."""

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
4. Provide a short explanation (1-3 sentences) justifying your score.""",
        
            "few_shots": """Example:
QUERY:
Quanti pianeti ci sono nel sistema solare e quali sono i loro nomi?
-----------
EXPECTED KEY ANSWER:
Ci sono otto pianeti nel sistema solare. I loro nomi sono: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
EXPECTED FULL ANSWER:
Nel nostro sistema solare, ci sono otto pianeti principali. Questi includono Mercurio, il pianeta più vicino al Sole, seguito da Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Ognuno di questi pianeti ha caratteristiche uniche e orbita intorno al Sole a diverse distanze.
-----------
GIVEN ANSWER:
Ci sono tre pianeti nel sistema solare: Terra, Marte e Venere.
-----------
Score: 0 // False information.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
-----------
Score: 0.3 // Many key information (eight planets), some are missing (their names), and many optional information (details about each planet) are missing.

// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
Score: 0.7 // All and only the key pieces of information (eight planets and their names), no optional information (details about each planet).
            """
        
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
    2 = Somewhere between 0% and 50% (included) of key pieces of information are present.
    3 = Somewhere between 50% and 100% (not included) of key pieces of information are present.
    4 = All key pieces of information are present.""",
            
            "instructions": """1. Read the QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. Evaluate the GIVEN ANSWER against the EXPECTED KEY ANSWER based on Accuracy, Completeness, and Relevance.
3. Assign a Correctness Score (0-4) with one decimal place.
4. Provide a short explanation (1-3 sentences) justifying your score.""",

        "few_shots": """Example:
QUERY:
Quanti pianeti ci sono nel sistema solare e quali sono i loro nomi?
-----------
EXPECTED KEY ANSWER:
Ci sono otto pianeti nel sistema solare. I loro nomi sono: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
EXPECTED FULL ANSWER:
Nel nostro sistema solare, ci sono otto pianeti principali. Questi includono Mercurio, il pianeta più vicino al Sole, seguito da Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Ognuno di questi pianeti ha caratteristiche uniche e orbita intorno al Sole a diverse distanze.
-----------
GIVEN ANSWER:
Ci sono tre pianeti nel sistema solare: Terra, Marte e Venere.
-----------
Score: 0 // False information.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
Score: 2 // 50% of key information (eight planets is present, their names are missing).

// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
Score: 4 // All key pieces of information (eight planets and their names) are present.
            """
        
        },
        
"llm_sub": {
    "task_description": "Your task is to compare the provided answer with the answer containing BOTH the key and the optional information, focusing on how well it covers the optional details while remaining factually correct on the key points.",
    
    "expected_output": """You're expected to compare the GIVEN ANSWER against the EXPECTED FULL ANSWER.
You're expected to provide:
1. A Correctness Score (0 to 4, in increments of 1) comparing the GIVEN ANSWER with the EXPECTED FULL ANSWER.
2. A brief explanation (1-3 sentences) justifying your score.""",

    "score_criteria": """Correctness Score (0 to 4, in increments of 1):
    0 = The answer contains incorrect or fabricated information (key or optional) OR is completely unrelated.
    1 = The answer contains almost no optional information (it might only state a generic fact, but still factually correct on key points).
    2 = The answer contains some optional details, roughly up to 50% of those in the expected full answer.
    3 = The answer contains most of the optional details, roughly between 50% and 100% (not all).
    4 = The answer contains all or nearly all optional details from the expected full answer, with no factual errors.""",

    "instructions": """1. Read the QUERY, EXPECTED FULL ANSWER, and the GIVEN ANSWER carefully.
2. First check factual correctness: if the GIVEN ANSWER contains false information (even about key facts), assign score 0.
3. Otherwise, evaluate how completely the GIVEN ANSWER matches the EXPECTED FULL ANSWER, with emphasis on the optional details (since key information is already expected to be correct).
4. Assign a Correctness Score (0-4).
5. Provide a short explanation (1-3 sentences) justifying your score.""",

    "few_shots" : """Example:
QUERY:
Quanti pianeti ci sono nel sistema solare e quali sono i loro nomi?
-----------
EXPECTED FULL ANSWER:
Nel nostro sistema solare, ci sono otto pianeti principali. Questi includono Mercurio, il pianeta più vicino al Sole, seguito da Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Ognuno di questi pianeti ha caratteristiche uniche e orbita intorno al Sole a diverse distanze.
-----------
GIVEN ANSWER:
Ci sono tre pianeti nel sistema solare: Terra, Marte e Venere.
-----------
Score: 0 // False information about the number of planets.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
-----------
Score: 1 // Only the bare key fact is present, no optional details (e.g., names or descriptions).


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
Score: 2 // Includes key facts and names, but no optional descriptions about the planets.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il pianeta più vicino al Sole.
-----------
Score: 3 // Includes key facts, names, and part of the optional information (one description).


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il pianeta più vicino al Sole, ognuno ha caratteristiche uniche e orbita a diverse distanze.
-----------
Score: 4 // Includes all key facts, names, and essentially all optional details.
"""
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
4. Provide a single explanation (1-3 sentences) that justifies both scores, clearly referring to the key-only comparison and the full-answer comparison.""",
"few_shots": """Example:
QUERY:
Quanti pianeti ci sono nel sistema solare e quali sono i loro nomi?
-----------
EXPECTED KEY ANSWER:
Ci sono otto pianeti nel sistema solare. I loro nomi sono: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
EXPECTED FULL ANSWER:
Nel nostro sistema solare, ci sono otto pianeti principali. Questi includono Mercurio, il pianeta più vicino al Sole, seguito da Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Ognuno di questi pianeti ha caratteristiche uniche e orbita intorno al Sole a diverse distanze.
-----------
GIVEN ANSWER:
Ci sono tre pianeti nel sistema solare: Terra, Marte e Venere.
-----------
Scores: 0 (key), 0 (full)
// Explanation: The answer is factually incorrect because it lists only three planets instead of eight. Both key and optional information are missing.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
-----------
Scores: 2 (key), 1 (full)
// Explanation: The answer contains the correct number of planets, so some key information is present, but it lacks the names (key) and all optional information (full).


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
Scores: 4 (key), 2 (full)
// Explanation: The answer is fully correct with respect to the key answer (all planets and names are given), but it lacks optional information such as the description of each planet, so the full-answer score is partial.


// Another GIVEN ANSWER
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il pianeta più vicino al Sole.
-----------
Scores: 4 (key), 3 (full)
// Explanation: This answer includes all key information and part of the optional details (only one planet's detail is provided), so the key score is perfect but the full-answer score is high but not maximum.
"""
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

{config['few_shots']}

Instructions:
{config['instructions']}

{shallower_reinforcement_on_0}
{reinforced_attention_on_0}

{''.join(input_blocks)}
""".strip()

    return prompt_template

