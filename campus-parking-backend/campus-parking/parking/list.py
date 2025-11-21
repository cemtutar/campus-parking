import json
import utils

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
}


def handler(event, context):
    items = utils.list_spots()
    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps(items),
    }
