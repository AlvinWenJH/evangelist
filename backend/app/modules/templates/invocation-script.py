import requests


def request_invocation(
    data: dict, url: str, method: str = "POST", input_type: dict = None
):
    """
    Request invocation to the invocation server with configuration-based data mapping.

    Args:
        data (dict): The previous step result data containing input values.
        url (str): The URL of the invocation server.
        method (str): The HTTP method for the request. Defaults to "POST".
        input_type (dict): Configuration for mapping data to request body.

    Returns:
        dict: The output data from the invocation server.
    """
    import re

    # Build the request payload based on input_type configuration
    request_payload = {}

    if input_type and "body" in input_type and "json" in input_type["body"]:
        json_config = input_type["body"]["json"]

        for item in json_config:
            if item.get("enabled", True):
                key = item["key"]
                value = item["value"]

                # Handle variable substitution like @[name], @[email]
                if (
                    isinstance(value, str)
                    and value.startswith("@[")
                    and value.endswith("]")
                ):
                    var_name = value[2:-1]  # Extract variable name from @[var_name]

                    # Look for the variable in data.input first, then in data itself
                    if "input" in data and var_name in data["input"]:
                        request_payload[key] = data["input"][var_name]
                    elif var_name in data:
                        request_payload[key] = data[var_name]
                    else:
                        # If variable not found, use the original value
                        request_payload[key] = value
                else:
                    # Use the value as-is if it's not a variable reference
                    request_payload[key] = value
    else:
        # Fallback: use data.input if available, otherwise use data directly
        request_payload = data.get("input", data)

    response = requests.request(method, url, json=request_payload)
    response.raise_for_status()
    return {"response": response.json()}
