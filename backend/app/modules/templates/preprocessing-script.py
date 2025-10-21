def preprocess_data(data: dict, input_columns: list = [], groundtruth_column: str = ""):
    """
    Preprocess data to enter evaluation
    Args:
        data (dict): Raw data to preprocess in "column" and "value" pair format
        input_columns (list): List of column name to select the input data from
        groundtruth_column (str): Column name to select the groundtruth data from
    Returns:
        dict: Preprocessed data in "column" and "value" pair format
    """
    # Check if input_columns is a subset of data keys
    if input_columns and not set(input_columns).issubset(set(data.keys())):
        raise ValueError("All input_columns must be present in the data")
    # Check if groundtruth_column is a subset of data keys
    if groundtruth_column and groundtruth_column not in data.keys():
        raise ValueError("groundtruth_column must be present in the data")

    if groundtruth_column:
        groundtruth = data[groundtruth_column]
    else:
        groundtruth = ""
    # Select only the columns specified in input_columns
    if input_columns:
        data = {k: v for k, v in data.items() if k in input_columns}
    else:
        data = {}
    # Select only the columns specified in groundtruth_columns

    return {"input": data, "groundtruth": groundtruth}
