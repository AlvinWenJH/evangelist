from google import genai
from google.genai import types
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

client = genai.Client()


# Define Metrics
def calculate_similarity(output: str, groundtruth: str):
    """
    Calculate similarity between output and groundtruth
    Args:
        output (str): Output data to evaluate
        groundtruth (str): Groundtruth data to compare with
    Returns:
        float: Similarity score between 0 and 1
    """
    texts = [output, groundtruth]
    result = [
        np.array(e.values)
        for e in client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
            config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
        ).embeddings
    ]
    embeddings_matrix = np.array(result)
    similarity_matrix = cosine_similarity(embeddings_matrix)
    similarity = similarity_matrix[0, 1]

    return similarity


# Main Evaluation Script
def evaluate_data(input_data: dict, output_data: dict, metrics: list[str]):
    """
    Evaluate data based on the metrics
    Args:
        input_data (dict): Preprocessed input data in "field" and "value" pair format
        output_data (dict): Preprocessed output data in "field" and "value" pair format
        metrics (list[str]): List of metrics to evaluate
    Returns:
        dict: Evaluation results in "metric" and "value" pair format
    """
    results = {}
    if "similarity" in metrics:
        similarity = calculate_similarity(
            output_data["output"], input_data["groundtruth"]
        )
        results["similarity"] = similarity

    return results
