import requests


def request_invocation(
    url: str, data: dict, headers: dict = None, method: str = "POST"
):
    """
    Request invocation to the invocation server.

    Args:
        url (str): The URL of the invocation server.
        data (dict): The input data for the invocation server.
        headers (dict, optional): The headers for the request. Defaults to None.

    Returns:
        dict: The output data from the invocation server.
    """

    response = requests.request(method, url, json=data, headers=headers)
    response.raise_for_status()
    return {"response": response.json()}
