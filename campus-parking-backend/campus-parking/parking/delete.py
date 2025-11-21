import json
import utils

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
}


def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"message": "Invalid JSON body"})

    spot_id = body.get("spotId")
    if not spot_id:
        return _response(400, {"message": "spotId is required"})

    existing = utils.get_spot(spot_id)
    if not existing:
        return _response(404, {"message": f"Spot {spot_id} not found"})

    deleted = utils.delete_spot(spot_id)
    return _response(200, deleted or {"spotId": spot_id, "deleted": True})


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": HEADERS,
        "body": json.dumps(payload),
    }
