import re


def postprocess_data(data: dict, field: str):
    """
    Postprocess data after evaluation/invocation
    Args:
        data (dict): Raw data to postprocess from previous step (invocation result)
        field (str): Field path to select the data from, supports dot notation and array indexing
                    Examples: "message", "messages.[0].text", "data.results.[2].value"
    Returns:
        dict: Postprocessed data in "output" format
    """
    try:
        current = data

        # Split the field path by dots, but preserve array notation
        # Convert "messages.[0].text" to ["messages", "[0]", "text"]
        parts = []
        current_part = ""

        i = 0
        while i < len(field):
            if field[i] == ".":
                if current_part:
                    parts.append(current_part)
                    current_part = ""
            elif field[i] == "[":
                if current_part:
                    parts.append(current_part)
                    current_part = ""
                # Find the closing bracket
                bracket_end = field.find("]", i)
                if bracket_end == -1:
                    raise ValueError(f"Unclosed bracket in field path: {field}")
                parts.append(field[i : bracket_end + 1])
                i = bracket_end
                current_part = ""
            else:
                current_part += field[i]
            i += 1

        if current_part:
            parts.append(current_part)

        # Navigate through the data structure
        for part in parts:
            if not part:  # Skip empty parts
                continue

            # Handle array indexing [n]
            if part.startswith("[") and part.endswith("]"):
                index_str = part[1:-1]
                if not index_str.isdigit():
                    raise ValueError(f"Invalid array index: {part}")
                index = int(index_str)

                if not isinstance(current, list):
                    raise ValueError(
                        f"Expected list for array access, got {type(current).__name__}"
                    )
                if index >= len(current):
                    raise ValueError(
                        f"Array index {index} out of range (length: {len(current)})"
                    )

                current = current[index]

            # Handle object property access
            else:
                if not isinstance(current, dict):
                    raise ValueError(
                        f"Expected dict for property access, got {type(current).__name__}"
                    )
                if part not in current:
                    raise ValueError(f"Property '{part}' not found in object")

                current = current[part]

        return {"output": current}

    except Exception as e:
        raise ValueError(f"Error accessing field '{field}': {str(e)}")
