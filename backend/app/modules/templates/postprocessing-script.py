def preprocess_data(data: dict, field: list[str]):
    """
    Preprocess data to enter evaluation
    Args:
        data (dict): Raw data to preprocess in "column" and "value" pair format
        field (list[str]): List of nested field name to select the data from
                          Supports array indexing with numeric strings (e.g., ["content", "choices", "0", "text"])
    Returns:
        dict: Preprocessed data in "field" and "value" pair format
    """
    current = data

    # Traverse the nested field path
    for f in field:
        try:
            # Check if current is a list and f is a numeric index
            if isinstance(current, list) and f.isdigit():
                index = int(f)
                if index >= len(current):
                    raise ValueError(
                        f"Index {index} is out of range for array of length {len(current)}"
                    )
                current = current[index]
            # Check if current is a dict and f is a key
            elif isinstance(current, dict):
                if f not in current:
                    raise ValueError(f"Field '{f}' not found in data at current level")
                current = current[f]
            else:
                raise ValueError(
                    f"Cannot access field '{f}' on {type(current).__name__}"
                )
        except (KeyError, IndexError, TypeError) as e:
            raise ValueError(f"Error accessing field '{f}': {str(e)}")

    return {"output": current}
