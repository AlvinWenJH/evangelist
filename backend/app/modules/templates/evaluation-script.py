import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from google import genai


# Define Metrics
def calculate_similarity(output: str, groundtruth: str):
    """
    Calculate similarity between output and groundtruth using Google GenAI client
    Args:
        output (str): Output data to evaluate
        groundtruth (str): Groundtruth data to compare with
    Returns:
        float: Similarity score between 0 and 1
    """
    # Get API key from environment variable
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    # Configure the GenAI client
    client = genai.Client(api_key=api_key)

    # Get embeddings for both texts
    result = client.models.embed_content(
        model="gemini-embedding-001", contents=[output, groundtruth]
    )

    # Extract embeddings and convert to numpy arrays
    embeddings = []
    for embedding in result.embeddings:
        embeddings.append(np.array(embedding.values))

    # Calculate cosine similarity
    embeddings_matrix = np.array(embeddings)
    similarity_matrix = cosine_similarity(embeddings_matrix)
    similarity = similarity_matrix[0, 1]

    return float(similarity)


# Main Evaluation Script
def evaluate_data(results: dict, metrics: list[str]):
    """
    Evaluate data based on the metrics
    Args:
        results (dict): All step results from the workflow execution
                       Example structure:
                       {
                         "load_data": { "id": 1, "name": "John Doe", ... },
                         "preprocessing": { "input": {...}, "groundtruth": "" },
                         "invocation": { "response": { "message": "Found", "data": {} } },
                         "postprocessing": { "output": "Found" }
                       }
        metrics (list[str]): List of metrics to evaluate
    Returns:
        dict: Evaluation results in "metric" and "value" pair format
    """
    evaluation_results = {}

    # Extract data from different steps
    preprocessing = results.get("preprocessing", {})
    postprocessing = results.get("postprocessing", {})

    # Calculate metrics based on available data
    if "similarity" in metrics:
        # Get groundtruth from preprocessing step
        groundtruth = preprocessing.get("groundtruth", "")
        # Get output from postprocessing step
        output = postprocessing.get("output", "")

        if groundtruth and output:
            similarity = calculate_similarity(output, groundtruth)
            evaluation_results["similarity"] = similarity
        else:
            evaluation_results["similarity"] = 0.0

    # Add more metrics as needed
    # Example: accuracy, precision, recall, etc.

    return evaluation_results
