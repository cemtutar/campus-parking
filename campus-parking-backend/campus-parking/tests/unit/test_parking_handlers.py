import json
from unittest import mock

import pytest

from parking import list as list_handler
from parking import occupy as occupy_handler
from parking import register as register_handler
from parking import release as release_handler
from parking import delete as delete_handler


@pytest.fixture
def mock_utils():
  with mock.patch("parking.list.utils") as list_utils, mock.patch(
    "parking.register.utils"
  ) as register_utils, mock.patch("parking.occupy.utils") as occupy_utils, mock.patch(
    "parking.release.utils"
  ) as release_utils, mock.patch("parking.delete.utils") as delete_utils:
    yield list_utils, register_utils, occupy_utils, release_utils, delete_utils


def test_list_spots_success(mock_utils):
  list_utils, *_ = mock_utils
  list_utils.list_spots.return_value = [{"spotId": "A1", "status": "AVAILABLE"}]

  resp = list_handler.handler({}, {})

  assert resp["statusCode"] == 200
  body = json.loads(resp["body"])
  assert body == [{"spotId": "A1", "status": "AVAILABLE"}]
  list_utils.list_spots.assert_called_once_with()


def test_register_spot_happy_path(mock_utils):
  _, register_utils, *_ = mock_utils
  register_utils.register_spot.return_value = {"spotId": "B2", "status": "AVAILABLE"}

  event = {"body": json.dumps({"spotId": "B2", "lotId": "Lot1", "lat": 1.0, "lon": 2.0})}

  resp = register_handler.handler(event, {})

  assert resp["statusCode"] == 201
  body = json.loads(resp["body"])
  assert body["spotId"] == "B2"
  register_utils.register_spot.assert_called_once()


def test_register_spot_missing_id(mock_utils):
  _, register_utils, *_ = mock_utils

  event = {"body": json.dumps({"lotId": "Lot1"})}
  resp = register_handler.handler(event, {})

  assert resp["statusCode"] == 400
  body = json.loads(resp["body"])
  assert body["message"] == "spotId is required"
  register_utils.register_spot.assert_not_called()


def test_occupy_spot_not_found(mock_utils):
  *_, occupy_utils, __ = mock_utils
  occupy_utils.get_spot.return_value = None

  event = {"body": json.dumps({"spotId": "C3"})}
  resp = occupy_handler.handler(event, {})

  assert resp["statusCode"] == 404
  body = json.loads(resp["body"])
  assert body["message"] == "Spot C3 not found"
  occupy_utils.update_spot_status.assert_not_called()


def test_occupy_spot_success(mock_utils):
  *_, occupy_utils, __ = mock_utils
  occupy_utils.get_spot.return_value = {"spotId": "C3", "status": "AVAILABLE"}
  occupy_utils.update_spot_status.return_value = {
    "spotId": "C3",
    "status": "OCCUPIED",
  }

  event = {"body": json.dumps({"spotId": "C3"})}
  resp = occupy_handler.handler(event, {})

  assert resp["statusCode"] == 200
  body = json.loads(resp["body"])
  assert body["status"] == "OCCUPIED"
  occupy_utils.update_spot_status.assert_called_once_with("C3", "OCCUPIED")


def test_release_spot_success(mock_utils):
  *_, release_utils, __ = mock_utils
  release_utils.get_spot.return_value = {"spotId": "D4", "status": "OCCUPIED"}
  release_utils.update_spot_status.return_value = {
    "spotId": "D4",
    "status": "AVAILABLE",
  }

  event = {"body": json.dumps({"spotId": "D4"})}
  resp = release_handler.handler(event, {})

  assert resp["statusCode"] == 200
  body = json.loads(resp["body"])
  assert body["status"] == "AVAILABLE"
  release_utils.update_spot_status.assert_called_once_with("D4", "AVAILABLE")


def test_delete_spot_not_found(mock_utils):
  *_, delete_utils = mock_utils
  delete_utils.get_spot.return_value = None

  event = {"body": json.dumps({"spotId": "E5"})}
  resp = delete_handler.handler(event, {})

  assert resp["statusCode"] == 404
  body = json.loads(resp["body"])
  assert body["message"] == "Spot E5 not found"
  delete_utils.delete_spot.assert_not_called()


def test_delete_spot_success(mock_utils):
  *_, delete_utils = mock_utils
  delete_utils.get_spot.return_value = {"spotId": "E5", "status": "AVAILABLE"}
  delete_utils.delete_spot.return_value = {"spotId": "E5", "status": "AVAILABLE"}

  event = {"body": json.dumps({"spotId": "E5"})}
  resp = delete_handler.handler(event, {})

  assert resp["statusCode"] == 200
  body = json.loads(resp["body"])
  assert body["spotId"] == "E5"
  delete_utils.delete_spot.assert_called_once_with("E5")
