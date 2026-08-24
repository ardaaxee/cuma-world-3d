extends Node

signal room_lookup_result(ok: bool, relay_url: String, message: String)
signal server_registration_result(ok: bool, message: String)

const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const SESSION_CODE_LENGTH = 6
const MAX_RESPONSE_BYTES = 8192
const REQUEST_TIMEOUT_SECONDS = 7.0
const DEFAULT_ROOM_TTL_SECONDS = 150

var base_url = ""
var request_node: HTTPRequest
var request_mode = ""
var request_code = ""

func _ready() -> void:
	base_url = OS.get_environment("CUMA_CONTROL_PLANE_URL").strip_edges().trim_suffix("/")
	if base_url.is_empty():
		base_url = str(ProjectSettings.get_setting("network/cloudflare_control_plane_url", "")).strip_edges().trim_suffix("/")
	request_node = HTTPRequest.new()
	request_node.timeout = REQUEST_TIMEOUT_SECONDS
	add_child(request_node)
	request_node.request_completed.connect(_on_request_completed)

func is_configured() -> bool:
	return base_url.begins_with("https://") and base_url.length() <= 512

func is_busy() -> bool:
	return not request_mode.is_empty()

func lookup_room(invite_code: String) -> int:
	var code = _sanitize_session_code(invite_code)
	if code.length() != SESSION_CODE_LENGTH:
		return ERR_INVALID_PARAMETER
	if not is_configured() or is_busy() or request_node == null:
		return ERR_UNAVAILABLE
	request_mode = "lookup"
	request_code = code
	var err = request_node.request(
		base_url + "/v1/rooms/" + code,
		PackedStringArray(["Accept: application/json"]),
		HTTPClient.METHOD_GET
	)
	if err != OK:
		_clear_request()
	return err

func register_room(invite_code: String, relay_url: String, build_label: String = "3.0-dev", region: String = "") -> int:
	var code = _sanitize_session_code(invite_code)
	var token = OS.get_environment("CUMA_CONTROL_TOKEN").strip_edges()
	var clean_relay = relay_url.strip_edges().trim_suffix("/")
	if code.length() != SESSION_CODE_LENGTH or not clean_relay.begins_with("wss://"):
		return ERR_INVALID_PARAMETER
	if token.is_empty() or token.length() > 512 or not is_configured() or is_busy() or request_node == null:
		return ERR_UNAVAILABLE
	request_mode = "register"
	request_code = code
	var body = JSON.stringify({
		"relay_url": clean_relay.left(512),
		"build": build_label.strip_edges().left(48),
		"region": region.strip_edges().left(24),
		"capacity": 2,
		"ttl_seconds": DEFAULT_ROOM_TTL_SECONDS,
	})
	var err = request_node.request(
		base_url + "/v1/rooms/" + code,
		_control_headers(token),
		HTTPClient.METHOD_PUT,
		body
	)
	if err != OK:
		_clear_request()
	return err

func heartbeat_room(invite_code: String) -> int:
	var code = _sanitize_session_code(invite_code)
	var token = OS.get_environment("CUMA_CONTROL_TOKEN").strip_edges()
	if code.length() != SESSION_CODE_LENGTH or token.is_empty() or not is_configured() or is_busy() or request_node == null:
		return ERR_UNAVAILABLE
	request_mode = "heartbeat"
	request_code = code
	var body = JSON.stringify({"ttl_seconds": DEFAULT_ROOM_TTL_SECONDS})
	var err = request_node.request(
		base_url + "/v1/rooms/" + code + "/heartbeat",
		_control_headers(token),
		HTTPClient.METHOD_POST,
		body
	)
	if err != OK:
		_clear_request()
	return err

func unregister_room(invite_code: String) -> int:
	var code = _sanitize_session_code(invite_code)
	var token = OS.get_environment("CUMA_CONTROL_TOKEN").strip_edges()
	if code.length() != SESSION_CODE_LENGTH or token.is_empty() or not is_configured() or is_busy() or request_node == null:
		return ERR_UNAVAILABLE
	request_mode = "unregister"
	request_code = code
	var err = request_node.request(
		base_url + "/v1/rooms/" + code,
		_control_headers(token),
		HTTPClient.METHOD_DELETE
	)
	if err != OK:
		_clear_request()
	return err

func _on_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	var mode = request_mode
	_clear_request()
	if body.size() > MAX_RESPONSE_BYTES:
		_emit_failure(mode, "Yanıt çok büyük")
		return
	var parsed = null
	if not body.is_empty():
		parsed = JSON.parse_string(body.get_string_from_utf8())

	if mode == "lookup":
		if response_code != 200 or not (parsed is Dictionary):
			room_lookup_result.emit(false, "", "Oda bulunamadı")
			return
		var response: Dictionary = parsed
		var room_value = response.get("room", {})
		if not (room_value is Dictionary):
			room_lookup_result.emit(false, "", "Oda yanıtı geçersiz")
			return
		var room: Dictionary = room_value
		var relay_url = str(room.get("relay_url", "")).strip_edges()
		if not relay_url.begins_with("wss://") or relay_url.length() > 512:
			room_lookup_result.emit(false, "", "Relay adresi geçersiz")
			return
		room_lookup_result.emit(true, relay_url, "Oda bulundu")
		return

	if response_code >= 200 and response_code < 300:
		server_registration_result.emit(true, mode)
	else:
		server_registration_result.emit(false, mode + " HTTP " + str(response_code))

func _emit_failure(mode: String, message: String) -> void:
	if mode == "lookup":
		room_lookup_result.emit(false, "", message)
	else:
		server_registration_result.emit(false, message)

func _control_headers(token: String) -> PackedStringArray:
	return PackedStringArray([
		"Accept: application/json",
		"Content-Type: application/json",
		"Authorization: Bearer " + token,
	])

func _sanitize_session_code(value: String) -> String:
	var clean = value.to_upper().strip_edges().replace("-", "").replace(" ", "")
	var out = ""
	for i in range(clean.length()):
		var ch = clean.substr(i, 1)
		if SESSION_CODE_ALPHABET.contains(ch):
			out += ch
	return out.left(SESSION_CODE_LENGTH)

func _clear_request() -> void:
	request_mode = ""
	request_code = ""
