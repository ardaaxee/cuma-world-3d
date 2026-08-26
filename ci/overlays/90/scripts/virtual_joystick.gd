extends Control

signal direction_changed(value: Vector2)

const DEAD_ZONE := 0.14
const RESPONSE_POWER := 1.15
const MIN_RADIUS := 42.0
const MAX_RADIUS := 62.0

var touch_id := -1
var mouse_active := false
var direction := Vector2.ZERO
var radius := 50.0
var sensitivity := 1.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var cfg = ConfigFile.new()
	if cfg.load("user://cuma_menu_preferences.cfg") == OK:
		sensitivity = clamp(float(cfg.get_value("controls", "joystick_sensitivity", 1.0)), 0.65, 1.45)
	_update_radius()
	resized.connect(_update_radius)
	queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_release_pointer()
	elif what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_release_pointer()

func _exit_tree() -> void:
	_release_pointer()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and touch_id == -1:
			touch_id = event.index
			_update_direction(event.position)
		elif not event.pressed and event.index == touch_id:
			_release_pointer()
	elif event is InputEventScreenDrag and event.index == touch_id:
		_update_direction(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		mouse_active = event.pressed
		if mouse_active:
			_update_direction(event.position)
		else:
			_set_direction(Vector2.ZERO)
	elif event is InputEventMouseMotion and mouse_active:
		_update_direction(event.position)

func _update_radius() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return
	radius = clamp(min(size.x, size.y) * 0.44, MIN_RADIUS, MAX_RADIUS)
	queue_redraw()

func _update_direction(local_position: Vector2) -> void:
	var center = size * 0.5
	var offset = local_position - center
	var raw = offset.limit_length(radius) / max(radius, 1.0)
	_set_direction(_shape_direction(raw))

func _shape_direction(value: Vector2) -> Vector2:
	var magnitude = clamp(value.length(), 0.0, 1.0)
	if magnitude <= DEAD_ZONE:
		return Vector2.ZERO
	var normalized_strength = (magnitude - DEAD_ZONE) / (1.0 - DEAD_ZONE)
	normalized_strength = pow(clamp(normalized_strength, 0.0, 1.0), RESPONSE_POWER)
	normalized_strength = clamp(normalized_strength * sensitivity, 0.0, 1.0)
	return value.normalized() * normalized_strength

func _release_pointer() -> void:
	touch_id = -1
	mouse_active = false
	_set_direction(Vector2.ZERO)

func _set_direction(value: Vector2) -> void:
	var next = value.limit_length(1.0)
	if direction.is_equal_approx(next):
		return
	direction = next
	direction_changed.emit(direction)
	queue_redraw()

func _draw() -> void:
	var center = size * 0.5
	draw_circle(center, radius + 11.0, Color(0.03, 0.04, 0.055, 0.25))
	draw_circle(center, radius, Color(0.18, 0.22, 0.28, 0.20))
	draw_circle(center + direction * radius, 21.0, Color(0.90, 0.93, 0.98, 0.76))
