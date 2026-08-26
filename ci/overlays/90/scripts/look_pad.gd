extends Control

signal look_dragged(delta: Vector2)

const DELTA_LIMIT := 72.0
const SMOOTH_WEIGHT := 0.72

var touch_id := -1
var last_position := Vector2.ZERO
var mouse_active := false
var smoothed_delta := Vector2.ZERO

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP

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
			last_position = event.position
			smoothed_delta = Vector2.ZERO
		elif not event.pressed and event.index == touch_id:
			_release_pointer()
	elif event is InputEventScreenDrag and event.index == touch_id:
		_emit_delta(event.relative)
		last_position = event.position
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		mouse_active = event.pressed
		last_position = event.position
		if not mouse_active:
			smoothed_delta = Vector2.ZERO
	elif event is InputEventMouseMotion and mouse_active:
		_emit_delta(event.relative)

func _emit_delta(raw_delta: Vector2) -> void:
	var limited = raw_delta.limit_length(DELTA_LIMIT)
	smoothed_delta = smoothed_delta.lerp(limited, SMOOTH_WEIGHT)
	if smoothed_delta.length_squared() > 0.0001:
		look_dragged.emit(smoothed_delta)

func _release_pointer() -> void:
	touch_id = -1
	mouse_active = false
	smoothed_delta = Vector2.ZERO
