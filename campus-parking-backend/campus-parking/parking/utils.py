import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["TABLE_NAME"]
table = dynamodb.Table(TABLE_NAME)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_spot(spot_id: str, lot_id: str | None = None, lat=None, lon=None):
    item = {
        "spotId": spot_id,
        "status": "AVAILABLE",
        "lastUpdated": now_iso(),
    }
    if lot_id is not None:
        item["lotId"] = lot_id
    if lat is not None:
        item["lat"] = float(lat)
    if lon is not None:
        item["lon"] = float(lon)

    table.put_item(Item=item)
    return item


def get_spot(spot_id: str):
    resp = table.get_item(Key={"spotId": spot_id})
    return resp.get("Item")


def list_spots():
    resp = table.scan()
    return resp.get("Items", [])


def update_spot_status(spot_id: str, status: str):
    resp = table.update_item(
        Key={"spotId": spot_id},
        UpdateExpression="SET #s = :s, lastUpdated = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": status,
            ":u": now_iso(),
        },
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes")


def delete_spot(spot_id: str):
    resp = table.delete_item(
        Key={"spotId": spot_id},
        ReturnValues="ALL_OLD",
    )
    return resp.get("Attributes")
