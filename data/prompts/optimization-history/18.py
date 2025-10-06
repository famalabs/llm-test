# 18: more attention to dangerous information, reinforcement on 0.

shallower_reinforcement_on_0 = """Remember: If the given answer include false information, its score is 0."""
attention_on_0 = """Check every detail of the GIVEN ANSWER and meticoulously compare it to the EXPECTED ANSWERS. A fake information (temporal / factual etc..) lead to a score of 0 [!]."""
dangerous_info_warning ="""The answers are medically related. If the GIVEN ANSWER contains wrong medical indication with respect to the EXPECTED ANSWERS, the score must be 0."""
attention_on_rephrases = """But, be aware of rephrases: if the GIVEN ANSWER is a rephrase of the EXPECTED ANSWER, it should not be penalized."""

PROMPT_CONFIGS = {
"llm_full": {
    "task_description": """Your task is to evaluate how correct, complete, and relevant the GIVEN ANSWER is with respect to the EXPECTED KEY ANSWER (key information) and the EXPECTED FULL ANSWER (key + optional information). The comparison must be factual and meticulous, especially for potentially dangerous or medical content.""",
    
    "expected_output": """1. A Correctness Score (0 to 1, in increments of 0.1).
2. A brief explanation (1-3 sentences) justifying your score.""",

    "score_criteria": """Correctness Score (0 to 1, in increments of 0.1):

⚠ FIRST RULE: If there is ANY factual error, misleading claim, or contradiction with the expected answers — even small — the score is 0. This applies especially to medical or safety-related information.

If there are NO factual errors:
    0.1 = The answer contains no relevant key or optional information (generic, empty, or off-topic).
    0.2 = The answer is missing all key information but includes some optional or contextual hints.
    0.3 = The answer includes a small portion of the key information but lacks most of it; optional info limited or absent.
    0.4 = The answer lacks several key elements but includes many or all optional details.
    0.5 = The answer covers part of the key information but omits many key elements; optional details may be minimal.
    0.6 = The answer contains most key information and possibly some optional details.
    0.7 = The answer includes all and only the key information (no optional parts).
    0.8 = The answer includes all key information plus a few optional elements.
    0.9 = The answer includes all key information and many optional elements.
    1.0 = The answer fully includes all key information and all or nearly all optional elements.""",

    "instructions": """1. Read carefully: QUERY, EXPECTED KEY ANSWER, EXPECTED FULL ANSWER, and GIVEN ANSWER.
2. First check factual correctness: if the GIVEN ANSWER introduces any false statement or contradiction, assign score 0.
3. If factually correct, evaluate coverage of:
   - Key information (from the EXPECTED KEY ANSWER),
   - Optional information (from the EXPECTED FULL ANSWER),
   - Rephrase is allowed and should not be penalized.
4. Use the scoring scale above and assign a single score from 0 to 1 in increments of 0.1.
5. Provide a short justification (1-3 sentences).""",

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
Score: 0 // False information => immediate zero.

GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare.
-----------
Score: 0.3 // States the main fact but omits the names and all optional details.

GIVEN ANSWER:
Ci sono otto pianeti: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno.
-----------
Score: 0.7 // Covers all key facts, no optional details.

GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il più vicino al Sole.
-----------
Score: 0.8 or 0.9 // Contains all key information and at least one optional detail.

GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il pianeta più vicino al Sole, ognuno ha caratteristiche uniche e orbita a distanze diverse.
-----------
Score: 1.0 // All key + all optional.
"""
},
        
        "llm_main": {
        
            "task_description": "Your task is to compare the provided answer with the answer containing only key informations.",
        
            "expected_output": """You're expected to compare only the GIVEN ANSWER against the EXPECTED KEY ANSWER, using the QUERY and the EXPECTED FULL ANSWER just for the context.

You're expected to provide:
1. A Correctness Score (0 to 4, in increments of 1 - important: increments of 1 only) comparing the QUERY with the EXPECTED KEY ANSWER (the EXPECTED FULL ANSWER must be used just for the context).
2. A brief explanation (1-3 sentences) justifying your score.""",
            "score_criteria": """Correctness Score (0 to 4, in increments of 1 - important: increments of 1 only):
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
        
======== BAD EXAMPLE ========
GIVEN ANSWER:
Ci sono otto pianeti nel sistema solare: Mercurio, Venere, Terra, Marte, Giove, Saturno, Urano e Nettuno. Mercurio è il pianeta più vicino al Sole.
Score: 3.5 // WRONG! Increments of 1 only, so it should be 3 or 4.
            """
        
        },
        
"llm_sub": {
    "task_description": "Your task is to compare the provided answer with the answer containing BOTH the key and the optional information, focusing on how well it covers the optional details while remaining factually correct on the key points.",
    
    "expected_output": """You're expected to compare the GIVEN ANSWER against the EXPECTED FULL ANSWER.
You're expected to provide:
1. A Correctness Score (0 to 4, in increments of 1 - important: increments of 1 only) comparing the GIVEN ANSWER with the EXPECTED FULL ANSWER.
2. A brief explanation (1-3 sentences) justifying your score.""",

    "score_criteria": """Correctness Score (0 to 4, in increments of 1 - important: increments of 1 only):
    0 = The answer contains incorrect or fabricated information (key or optional) OR is completely unrelated.
    1 = The answer contains almost no optional information (it might only state a generic fact, but still factually correct on key points).
    2 = The answer contains some optional details, roughly up to 50% of those in the expected full answer.
    3 = The answer contains most of the optional details, roughly between 50% and 100% (not all).
    4 = The answer contains all or nearly all optional details from the expected full answer, with no factual errors.
    
Medical proactivity (medical consultancy if no information available, ecc...) should be rewarded, but only if the provided answer is factually correct with respect to the expected full answer.
    """,

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

======== BAD EXAMPLE ========
GIVEN ANSWER:
<anything>
SCORE:
3.5 // WRONG! Increments of 1 only, so it should be 3 or 4.
"""
},

        
        "llm_main_sub": {
            "task_description": """Your task is to compare the provided answer with BOTH:
- The answer containing only key information (EXPECTED KEY ANSWER).
- The answer containing both key and optional information (EXPECTED FULL ANSWER).""",
            "expected_output": """You're expected to provide:
1. TWO Correctness Scores (0 to 4, in increments of 1  - important: increments of 1 only): 
    * The first score is based on comparison with the EXPECTED KEY ANSWER.
    * The second score is based on comparison with the EXPECTED FULL ANSWER.
2. A brief explanation (1-3 sentences) justifying both scores.""",
            "score_criteria": """Correctness Score (0 to 4, in increments of 1 - important: increments of 1 only):
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

======== BAD EXAMPLE ========
GIVEN ANSWER:
<anything>
SCORE:
3.5 // WRONG! Increments of 1 only, so it should be 3 or 4.
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
{attention_on_0}
{dangerous_info_warning}

{attention_on_rephrases}

{''.join(input_blocks)}
""".strip()

    return prompt_template

