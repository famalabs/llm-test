HUGGINGFACE = 'huggingface' # placeholder per le metriche di HuggingFace

from sklearn.metrics.pairwise import cosine_similarity

def normalized_01_cosine_similarity(a, b):   
    cs = cosine_similarity(a, b).tolist()[0][0]
    # renormalize in 0,1
    cs = (cs + 1) / 2
    return cs