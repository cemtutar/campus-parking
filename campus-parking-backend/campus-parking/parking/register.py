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
    lot_id = body.get("lotId")
    lat = body.get("lat")
    lon = body.get("lon")

    if not spot_id:
        return _response(400, {"message": "spotId is required"})

    item = utils.register_spot(spot_id, lot_id, lat, lon)
    return _response(201, item)


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": HEADERS,
        "body": json.dumps(payload),
    }
