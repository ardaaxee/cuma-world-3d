extends Node

enum MenuState {
	BOOT,
	INTRO,
	MAIN_MENU,
	MULTIPLAYER,
	CHARACTER,
	WORLD_SELECT,
	SETTINGS,
	TRANSITION_TO_GAME,
	PLAYING,
	PAUSED,
}

const MenuCharacterScript = preload("res://scripts/ui/menu_character.gd")
const SAVE_CANDIDATES := [
	"user://cuma_world_save_v70.cfg",
	"user://cuma_world_save_v19.cfg",
	"user://cuma_world_save_v18.cfg",
	"user://cuma_world_save_v04.cfg",
	"user://cuma_world_save_v03.cfg",
]
const ACCENT := Color("d9c7a3")
const TEXT := Color("f3f0e9")
const MUTED := Color("a8a49b")
const PANEL := Color(0.025, 0.028, 0.032, 0.76)
const PANEL_SOFT := Color(0.035, 0.039, 0.045, 0.55)

var world_root: Node
var state: int = MenuState.BOOT
var elapsed := 0.0
var menu_camera: Camera3D
var menu_character: Node3D
var ui_layer: CanvasLayer
var ui_shell: Control
var safe_root: Control
var tone_overlay: ColorRect
var network_status_label: Label
var session_code_label: Label
var host_code_input: LineEdit
var join_address_input: LineEdit
var join_code_input: LineEdit
var host_enter_button: Button
var character_info_label: Label
var camera_updates_enabled := true

func setup(root: Node) -> void:
	world_root = root
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_menu_camera()
	_build_menu_character()
	_build_ui_shell()
	_connect_existing_systems()
	_set_state(MenuState.INTRO)

func _build_menu_camera() -> void:
	menu_camera = Camera3D.new()
	menu_camera.name = "MenuCamera"
	menu_camera.current = true
	menu_camera.fov = 54.0
	menu_camera.near = 0.08
	menu_camera.position = Vector3(13.6, 6.9, 20.4)
	add_child(menu_camera)
	menu_camera.look_at(Vector3(-1.2, 1.8, 10.7), Vector3.UP)

func _build_menu_character() -> void:
	menu_character = Node3D.new()
	menu_character.set_script(MenuCharacterScript)
	menu_character.position = Vector3(-5.2, 0.10, 12.0)
	menu_character.rotation_degrees.y = 180.0
	add_child(menu_character)
	menu_character.setup()

func _build_ui_shell() -> void:
	ui_layer = CanvasLayer.new()
	ui_layer.name = "CinematicMenuUI"
	ui_layer.layer = 80
	add_child(ui_layer)

	ui_shell = Control.new()
	ui_shell.name = "MenuShell"
	ui_shell.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_layer.add_child(ui_shell)

	tone_overlay = ColorRect.new()
	tone_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tone_overlay.color = Color(0.006, 0.008, 0.012, 0.15)
	tone_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_shell.add_child(tone_overlay)

	safe_root = Control.new()
	safe_root.name = "SafeArea"
	safe_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_shell.add_child(safe_root)
	_apply_safe_area()
	get_viewport().size_changed.connect(_on_viewport_size_changed)

func _connect_existing_systems() -> void:
	var net = get_node_or_null("/root/NetworkManager")
	if net != null:
		net.network_status_changed.connect(_on_network_status_changed)
		if net.has_signal("session_code_changed"):
			net.session_code_changed.connect(_on_session_code_changed)
		if net.has_signal("session_auth_result"):
			net.session_auth_result.connect(_on_session_auth_result)
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_signal("quality_changed"):
		gs.quality_changed.connect(_on_quality_changed)

func _process(delta: float) -> void:
	elapsed += delta
	if camera_updates_enabled and state != MenuState.TRANSITION_TO_GAME and state != MenuState.PLAYING:
		_update_menu_camera(delta)

func _update_menu_camera(delta: float) -> void:
	if menu_camera == null:
		return
	var pose = _camera_pose_for_state()
	var desired_position: Vector3 = pose["position"]
	var look_target: Vector3 = pose["target"]
	var drift_scale = float(pose.get("drift", 1.0))
	desired_position.x += sin(elapsed * 0.115) * 0.52 * drift_scale
	desired_position.y += sin(elapsed * 0.083 + 1.3) * 0.13 * drift_scale
	look_target.x += sin(elapsed * 0.095 + 0.8) * 0.16 * drift_scale
	var desired_transform = Transform3D(Basis.IDENTITY, desired_position).looking_at(look_target, Vector3.UP)
	var current = menu_camera.global_transform
	var blend = 1.0 - exp(-delta * 1.35)
	var current_q = current.basis.get_rotation_quaternion()
	var target_q = desired_transform.basis.get_rotation_quaternion()
	var next_q = current_q.slerp(target_q, blend)
	menu_camera.global_transform = Transform3D(Basis(next_q), current.origin.lerp(desired_position, blend))
	menu_camera.fov = lerp(menu_camera.fov, float(pose.get("fov", 54.0)), blend)

func _camera_pose_for_state() -> Dictionary:
	match state:
		MenuState.CHARACTER:
			return {
				"position": Vector3(-8.0, 2.45, 16.1),
				"target": Vector3(-5.2, 1.25, 12.0),
				"fov": 45.0,
				"drift": 0.35,
			}
		MenuState.WORLD_SELECT:
			return {
				"position": Vector3(17.5, 9.6, 23.0),
				"target": Vector3(-1.0, 1.7, 9.8),
				"fov": 50.0,
				"drift": 0.72,
			}
		MenuState.MULTIPLAYER, MenuState.SETTINGS:
			return {
				"position": Vector3(10.8, 5.8, 19.0),
				"target": Vector3(-1.2, 1.65, 10.8),
				"fov": 52.0,
				"drift": 0.62,
			}
		_:
			return {
				"position": Vector3(13.6, 6.9, 20.4),
				"target": Vector3(-1.2, 1.8, 10.7),
				"fov": 54.0,
				"drift": 1.0,
			}

func _set_state(next_state: int) -> void:
	if state == MenuState.TRANSITION_TO_GAME or state == MenuState.PLAYING:
		return
	state = next_state
	_rebuild_ui()

func _rebuild_ui() -> void:
	if safe_root == null:
		return
	for child in safe_root.get_children():
		safe_root.remove_child(child)
		child.queue_free()
	safe_root.modulate = Color.WHITE
	network_status_label = null
	session_code_label = null
	host_code_input = null
	join_address_input = null
	join_code_input = null
	host_enter_button = null
	character_info_label = null
	match state:
		MenuState.INTRO:
			_build_intro()
		MenuState.MAIN_MENU:
			_build_main_menu()
		MenuState.MULTIPLAYER:
			_build_multiplayer_menu()
		MenuState.CHARACTER:
			_build_character_menu()
		MenuState.WORLD_SELECT:
			_build_world_menu()
		MenuState.SETTINGS:
			_build_settings_menu()

func _build_intro() -> void:
	tone_overlay.color = Color(0.006, 0.008, 0.012, 0.18)
	var portrait = _is_portrait()
	var center = VBoxContainer.new()
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 12)
	center.anchor_left = 0.08 if portrait else 0.22
	center.anchor_right = 0.92 if portrait else 0.78
	center.anchor_top = 0.28
	center.anchor_bottom = 0.78
	safe_root.add_child(center)

	var logo = Label.new()
	logo.text = "CUMA WORLD"
	logo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	logo.add_theme_font_size_override("font_size", 48 if portrait else 66)
	logo.add_theme_color_override("font_color", TEXT)
	logo.add_theme_color_override("font_shadow_color", Color(0.85, 0.75, 0.57, 0.20))
	logo.add_theme_constant_override("shadow_offset_x", 0)
	logo.add_theme_constant_override("shadow_offset_y", 3)
	logo.add_theme_constant_override("outline_size", 1)
	logo.add_theme_color_override("font_outline_color", Color(0.05, 0.05, 0.06, 0.72))
	center.add_child(logo)

	var rule = ColorRect.new()
	rule.custom_minimum_size = Vector2(84, 1)
	rule.color = Color(ACCENT, 0.72)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	center.add_child(rule)

	var tagline = Label.new()
	tagline.text = "YOUR WORLD. YOUR STORY."
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tagline.add_theme_font_size_override("font_size", 13 if portrait else 15)
	tagline.add_theme_color_override("font_color", Color(MUTED, 0.94))
	center.add_child(tagline)

	var spacer = Control.new()
	spacer.custom_minimum_size.y = 22 if portrait else 34
	center.add_child(spacer)

	var enter = _make_primary_button("DÜNYAYA GİR")
	enter.custom_minimum_size = Vector2(245 if portrait else 290, 58)
	enter.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	enter.pressed.connect(_on_intro_enter)
	center.add_child(enter)
	enter.grab_focus()

func _on_intro_enter() -> void:
	if state != MenuState.INTRO:
		return
	var tween = create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(safe_root, "modulate:a", 0.0, 0.20)
	await tween.finished
	state = MenuState.MAIN_MENU
	_rebuild_ui()
	safe_root.modulate.a = 0.0
	create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT).tween_property(safe_root, "modulate:a", 1.0, 0.28)

func _build_main_menu() -> void:
	tone_overlay.color = Color(0.005, 0.007, 0.010, 0.12)
	var panel = _make_side_panel()
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(box)

	var eyebrow = _make_label("CUMA WORLD 3D", 13, MUTED)
	box.add_child(eyebrow)
	var heading = _make_label("ANA MENÜ", 30 if _is_portrait() else 36, TEXT)
	box.add_child(heading)
	var sub = _make_label(_world_clock_text(), 13, MUTED)
	box.add_child(sub)
	box.add_child(_vertical_gap(14))

	var continue_button = _make_menu_button("DEVAM ET")
	var save_path = _find_save_path()
	continue_button.disabled = save_path.is_empty()
	continue_button.pressed.connect(_on_continue_pressed)
	box.add_child(continue_button)
	var continue_detail = _make_label(_save_detail_text(save_path) if not save_path.is_empty() else "Kayıt bulunamadı", 12, MUTED)
	continue_detail.custom_minimum_size.y = 22
	box.add_child(continue_detail)

	var single = _make_menu_button("TEK OYUNCULU")
	single.pressed.connect(_on_single_player_pressed)
	box.add_child(single)
	var multiplayer_button = _make_menu_button("ÇOK OYUNCULU")
	multiplayer_button.pressed.connect(func(): _set_state(MenuState.MULTIPLAYER))
	box.add_child(multiplayer_button)
	var character_button = _make_menu_button("KARAKTER")
	character_button.pressed.connect(func(): _set_state(MenuState.CHARACTER))
	box.add_child(character_button)
	var world_button = _make_menu_button("DÜNYA")
	world_button.pressed.connect(func(): _set_state(MenuState.WORLD_SELECT))
	box.add_child(world_button)
	var settings_button = _make_menu_button("AYARLAR")
	settings_button.pressed.connect(func(): _set_state(MenuState.SETTINGS))
	box.add_child(settings_button)
	if not continue_button.disabled:
		continue_button.grab_focus()
	else:
		single.grab_focus()

func _build_multiplayer_menu() -> void:
	tone_overlay.color = Color(0.005, 0.007, 0.010, 0.14)
	var panel = _make_side_panel(0.50)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(box)
	_add_submenu_header(box, "ÇOK OYUNCULU", "Mevcut CUMA WORLD ağ sistemi")

	network_status_label = _make_label("OFFLINE", 13, MUTED)
	box.add_child(network_status_label)
	session_code_label = _make_label("", 17, ACCENT)
	box.add_child(session_code_label)
	var net = get_node_or_null("/root/NetworkManager")
	if net != null:
		_on_network_status_changed(str(net.status))
		if not str(net.session_code).is_empty():
			_on_session_code_changed(str(net.session_code))

	box.add_child(_section_rule("EV OLUŞTUR"))
	host_code_input = _make_line_edit("Oda kodu (boş bırakılırsa güvenli kod üretilir)")
	host_code_input.max_length = 6
	box.add_child(host_code_input)
	var host = _make_primary_button("EV OLUŞTUR")
	host.pressed.connect(_on_host_pressed)
	box.add_child(host)
	host_enter_button = _make_secondary_button("DÜNYAYA GİR")
	host_enter_button.visible = net != null and net.is_online() and str(net.network_mode) == "lan_host"
	host_enter_button.pressed.connect(func(): _begin_gameplay(false))
	box.add_child(host_enter_button)

	box.add_child(_section_rule("EVE KATIL"))
	join_address_input = _make_line_edit("Host IP")
	join_address_input.text = "127.0.0.1"
	box.add_child(join_address_input)
	join_code_input = _make_line_edit("6 karakter oda kodu")
	join_code_input.max_length = 6
	box.add_child(join_code_input)
	var join = _make_primary_button("EVE KATIL")
	join.pressed.connect(_on_join_pressed)
	box.add_child(join)
	box.add_child(_vertical_gap(5))
	box.add_child(_make_back_button())
	host.grab_focus()

func _on_host_pressed() -> void:
	var net = get_node_or_null("/root/NetworkManager")
	if net == null:
		_set_network_feedback("Ağ sistemi kullanılamıyor", false)
		return
	var requested = host_code_input.text if host_code_input != null else ""
	var err = int(net.host_lan(requested))
	if err == OK:
		if host_enter_button != null:
			host_enter_button.visible = true
		_on_session_code_changed(str(net.session_code))
		_set_network_feedback(str(net.status), true)
	else:
		_set_network_feedback("Ev oluşturulamadı • hata %d" % err, false)

func _on_join_pressed() -> void:
	var net = get_node_or_null("/root/NetworkManager")
	if net == null or join_address_input == null or join_code_input == null:
		_set_network_feedback("Ağ sistemi kullanılamıyor", false)
		return
	var err = int(net.join_lan(join_address_input.text, join_code_input.text))
	if err != OK:
		_set_network_feedback(str(net.status), false)
	else:
		_set_network_feedback(str(net.status), true)

func _on_network_status_changed(text: String) -> void:
	if network_status_label != null:
		network_status_label.text = text.left(96)

func _on_session_code_changed(code: String) -> void:
	if session_code_label != null:
		session_code_label.text = ("ODA KODU  •  " + code) if not code.is_empty() else ""

func _on_session_auth_result(ok: bool, message: String) -> void:
	_set_network_feedback(message, ok)
	if ok and state == MenuState.MULTIPLAYER:
		_begin_gameplay(false)

func _set_network_feedback(text: String, ok: bool) -> void:
	if network_status_label != null:
		network_status_label.text = text.left(96)
		network_status_label.add_theme_color_override("font_color", ACCENT if ok else Color("d9a29b"))

func _build_character_menu() -> void:
	tone_overlay.color = Color(0.005, 0.007, 0.010, 0.09)
	var panel = _make_side_panel(0.43)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(box)
	_add_submenu_header(box, "KARAKTER", "Gerçek oyun karakteri")
	character_info_label = _make_label(_character_detail_text(), 15, TEXT)
	character_info_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(character_info_label)
	var cycle = _make_primary_button("STİLİ DEĞİŞTİR")
	cycle.pressed.connect(_on_cycle_character_style)
	box.add_child(cycle)
	var note = _make_label("Bu ekran mevcut GameState karakter stilini ve oyunun CUMA karakter varlığını kullanır.", 12, MUTED)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(note)
	box.add_child(_vertical_gap(12))
	box.add_child(_make_back_button())
	cycle.grab_focus()

func _on_cycle_character_style() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs == null or not gs.has_method("cycle_character_style"):
		return
	gs.cycle_character_style()
	if menu_character != null and menu_character.has_method("refresh_customization"):
		menu_character.refresh_customization()
	if character_info_label != null:
		character_info_label.text = _character_detail_text()

func _character_detail_text() -> String:
	var gs = get_node_or_null("/root/GameState")
	if gs == null:
		return "CUMA"
	var style_name = gs.get_character_style_name() if gs.has_method("get_character_style_name") else "Mevcut stil"
	return "CUMA\n%s\nSaç stili %d" % [style_name, int(gs.hair_style) + 1]

func _build_world_menu() -> void:
	tone_overlay.color = Color(0.005, 0.007, 0.010, 0.08)
	var panel = _make_side_panel(0.43)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(box)
	_add_submenu_header(box, "DÜNYA", "Mevcut dünya")
	var world_name = _make_label("CUMA HOME", 28, TEXT)
	box.add_child(world_name)
	box.add_child(_make_label("SEÇİLİ", 12, ACCENT))
	box.add_child(_make_label(_world_clock_text(), 14, MUTED))
	var note = _make_label("Yeni bölgeler için genişletilebilir; projede bulunmayan dünya veya şehirler burada çalışıyormuş gibi gösterilmez.", 12, MUTED)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(note)
	box.add_child(_vertical_gap(16))
	box.add_child(_make_back_button())

func _build_settings_menu() -> void:
	tone_overlay.color = Color(0.005, 0.007, 0.010, 0.14)
	var panel = _make_side_panel(0.43)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(box)
	_add_submenu_header(box, "AYARLAR", "Mevcut sistemlere bağlı")
	var gs = get_node_or_null("/root/GameState")
	var profile = str(gs.quality_profile) if gs != null else "MEDIUM"
	box.add_child(_make_label("GRAFİK KALİTESİ", 12, MUTED))
	var quality = _make_primary_button(profile)
	quality.name = "QualityButton"
	quality.pressed.connect(_on_cycle_quality)
	box.add_child(quality)
	var note = _make_label("LOW / MEDIUM / HIGH profilleri mevcut GraphicsManager üzerinden uygulanır. Menü ek bir post-processing zinciri oluşturmaz.", 12, MUTED)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(note)
	box.add_child(_vertical_gap(14))
	box.add_child(_make_back_button())
	quality.grab_focus()

func _on_cycle_quality() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("cycle_quality"):
		gs.cycle_quality()

func _on_quality_changed(profile: String) -> void:
	if state != MenuState.SETTINGS or safe_root == null:
		return
	var button = safe_root.find_child("QualityButton", true, false)
	if button is Button:
		button.text = profile

func _on_continue_pressed() -> void:
	if _find_save_path().is_empty():
		return
	_begin_gameplay(true)

func _on_single_player_pressed() -> void:
	var net = get_node_or_null("/root/NetworkManager")
	if net != null and net.has_method("stop"):
		net.stop()
	_begin_gameplay(false)

func _begin_gameplay(load_saved_game: bool) -> void:
	if state == MenuState.TRANSITION_TO_GAME or state == MenuState.PLAYING:
		return
	var gs = get_node_or_null("/root/GameState")
	if load_saved_game:
		if gs == null:
			return
		var load_err = int(gs.load_game())
		if load_err != OK:
			state = MenuState.MAIN_MENU
			_rebuild_ui()
			return
		await get_tree().process_frame

	state = MenuState.TRANSITION_TO_GAME
	camera_updates_enabled = false
	var fade = create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	fade.tween_property(safe_root, "modulate:a", 0.0, 0.38)

	var player = world_root.call("_prepare_gameplay_from_menu") if world_root != null and world_root.has_method("_prepare_gameplay_from_menu") else null
	if player == null:
		state = MenuState.MAIN_MENU
		camera_updates_enabled = true
		_rebuild_ui()
		return
	player.set_physics_process(false)
	player.set_process_unhandled_input(false)
	await get_tree().process_frame

	var player_camera = player.get_node_or_null("CameraPivot/CameraSpring/PlayerCamera")
	if not (player_camera is Camera3D):
		player.set_physics_process(true)
		player.set_process_unhandled_input(true)
		world_root.call("_activate_gameplay_from_menu")
		queue_free()
		return
	player_camera.current = false
	menu_camera.current = true

	# Two-stage dolly aims through the central entrance before converging on the
	# gameplay camera, avoiding a straight exterior-to-interior wall cut.
	var player_focus = player.global_position + Vector3(0.0, 1.45, 0.0)
	var waypoint = Transform3D(Basis.IDENTITY, Vector3(0.0, 2.55, 10.65)).looking_at(player_focus, Vector3.UP)
	await _animate_camera_transform(waypoint, 0.62, 57.0)
	await _animate_camera_transform(player_camera.global_transform, 0.78, player_camera.fov)

	player_camera.current = true
	player.set_physics_process(true)
	player.set_process_unhandled_input(true)
	if world_root != null and world_root.has_method("_activate_gameplay_from_menu"):
		world_root.call("_activate_gameplay_from_menu")
	state = MenuState.PLAYING
	queue_free()

func _animate_camera_transform(target: Transform3D, duration: float, target_fov: float) -> void:
	var start = menu_camera.global_transform
	var start_q = start.basis.get_rotation_quaternion()
	var target_q = target.basis.get_rotation_quaternion()
	var start_fov = menu_camera.fov
	var passed := 0.0
	while passed < duration:
		await get_tree().process_frame
		var dt = max(get_process_delta_time(), 0.001)
		passed += dt
		var t = clamp(passed / duration, 0.0, 1.0)
		var eased = t * t * (3.0 - 2.0 * t)
		var q = start_q.slerp(target_q, eased)
		menu_camera.global_transform = Transform3D(Basis(q), start.origin.lerp(target.origin, eased))
		menu_camera.fov = lerp(start_fov, target_fov, eased)

func _find_save_path() -> String:
	for path in SAVE_CANDIDATES:
		if FileAccess.file_exists(path):
			return path
	return ""

func _save_detail_text(path: String) -> String:
	if path.is_empty():
		return ""
	var modified = int(FileAccess.get_modified_time(path))
	var now = int(Time.get_unix_time_from_system())
	if modified <= 0 or now < modified:
		return "CUMA HOME · Kayıt bulundu"
	var minutes = int((now - modified) / 60)
	if minutes < 1:
		return "CUMA HOME · Az önce"
	if minutes < 60:
		return "CUMA HOME · Son oynama %d dk önce" % minutes
	var hours = int(minutes / 60)
	if hours < 24:
		return "CUMA HOME · Son oynama %d sa önce" % hours
	return "CUMA HOME · Son oynama %d gün önce" % int(hours / 24)

func _world_clock_text() -> String:
	var gs = get_node_or_null("/root/GameState")
	if gs == null:
		return "CUMA HOME"
	var hour = int(floor(float(gs.time_of_day)))
	var minute = int(floor(fposmod(float(gs.time_of_day), 1.0) * 60.0))
	return "CUMA HOME  ·  GÜN %d  ·  %02d:%02d" % [int(gs.world_day), hour, minute]

func _make_side_panel(width_ratio: float = 0.42) -> PanelContainer:
	var portrait = _is_portrait()
	var panel = PanelContainer.new()
	panel.anchor_left = 0.04 if portrait else 0.035
	panel.anchor_right = 0.96 if portrait else width_ratio
	panel.anchor_top = 0.08 if portrait else 0.12
	panel.anchor_bottom = 0.94 if portrait else 0.90
	panel.add_theme_stylebox_override("panel", _panel_style(PANEL, 8))
	safe_root.add_child(panel)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_bottom", 22)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(margin)
	var holder = PanelContainer.new()
	holder.add_theme_stylebox_override("panel", _panel_style(Color.TRANSPARENT, 0))
	holder.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_child(holder)
	return holder

func _add_submenu_header(box: VBoxContainer, title: String, subtitle: String) -> void:
	box.add_child(_make_label("CUMA WORLD", 12, MUTED))
	box.add_child(_make_label(title, 30 if _is_portrait() else 35, TEXT))
	box.add_child(_make_label(subtitle, 12, MUTED))
	box.add_child(_vertical_gap(8))

func _make_menu_button(text_value: String) -> Button:
	var button = Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(250, 48 if _is_portrait() else 52)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.add_theme_font_size_override("font_size", 19 if _is_portrait() else 21)
	button.add_theme_color_override("font_color", Color(TEXT, 0.88))
	button.add_theme_color_override("font_hover_color", TEXT)
	button.add_theme_color_override("font_focus_color", TEXT)
	button.add_theme_color_override("font_disabled_color", Color(MUTED, 0.38))
	button.add_theme_stylebox_override("normal", _button_style(Color.TRANSPARENT, Color.TRANSPARENT))
	button.add_theme_stylebox_override("hover", _button_style(Color(1, 1, 1, 0.045), Color(ACCENT, 0.82)))
	button.add_theme_stylebox_override("focus", _button_style(Color(1, 1, 1, 0.052), ACCENT))
	button.add_theme_stylebox_override("pressed", _button_style(Color(1, 1, 1, 0.075), ACCENT))
	return button

func _make_primary_button(text_value: String) -> Button:
	var button = Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(220, 52)
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_color_override("font_color", TEXT)
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_stylebox_override("normal", _button_style(PANEL_SOFT, Color(ACCENT, 0.62), 1))
	button.add_theme_stylebox_override("hover", _button_style(Color(0.10, 0.10, 0.105, 0.86), ACCENT, 2))
	button.add_theme_stylebox_override("focus", _button_style(Color(0.10, 0.10, 0.105, 0.86), ACCENT, 2))
	button.add_theme_stylebox_override("pressed", _button_style(Color(0.13, 0.13, 0.135, 0.92), ACCENT, 2))
	return button

func _make_secondary_button(text_value: String) -> Button:
	var button = _make_primary_button(text_value)
	button.add_theme_stylebox_override("normal", _button_style(Color(0.02, 0.02, 0.025, 0.34), Color(1, 1, 1, 0.18), 1))
	return button

func _make_back_button() -> Button:
	var button = _make_menu_button("GERİ")
	button.custom_minimum_size.y = 46
	button.pressed.connect(func(): _set_state(MenuState.MAIN_MENU))
	return button

func _make_line_edit(placeholder: String) -> LineEdit:
	var input = LineEdit.new()
	input.placeholder_text = placeholder
	input.custom_minimum_size = Vector2(240, 50)
	input.add_theme_font_size_override("font_size", 14)
	input.add_theme_color_override("font_color", TEXT)
	input.add_theme_color_override("font_placeholder_color", Color(MUTED, 0.62))
	input.add_theme_stylebox_override("normal", _panel_style(Color(0.015, 0.018, 0.022, 0.72), 5, Color(1, 1, 1, 0.12)))
	input.add_theme_stylebox_override("focus", _panel_style(Color(0.018, 0.021, 0.026, 0.88), 5, Color(ACCENT, 0.62)))
	return input

func _section_rule(title: String) -> VBoxContainer:
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	box.add_child(_vertical_gap(4))
	box.add_child(_make_label(title, 11, ACCENT))
	var line = ColorRect.new()
	line.custom_minimum_size.y = 1
	line.color = Color(1, 1, 1, 0.10)
	box.add_child(line)
	return box

func _make_label(text_value: String, font_size: int, color: Color) -> Label:
	var label = Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func _vertical_gap(height: float) -> Control:
	var gap = Control.new()
	gap.custom_minimum_size.y = height
	return gap

func _button_style(background: Color, edge: Color, edge_width: int = 2) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = background
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.border_width_left = edge_width
	style.border_color = edge
	style.content_margin_left = 15.0
	style.content_margin_right = 12.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	return style

func _panel_style(background: Color, radius: int, border: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = background
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.border_width_left = 1 if border.a > 0.0 else 0
	style.border_width_top = 1 if border.a > 0.0 else 0
	style.border_width_right = 1 if border.a > 0.0 else 0
	style.border_width_bottom = 1 if border.a > 0.0 else 0
	style.border_color = border
	return style

func _is_portrait() -> bool:
	var size = get_viewport().get_visible_rect().size
	return size.y > size.x

func _on_viewport_size_changed() -> void:
	_apply_safe_area()
	if state not in [MenuState.TRANSITION_TO_GAME, MenuState.PLAYING]:
		_rebuild_ui()

func _apply_safe_area() -> void:
	if safe_root == null:
		return
	var viewport_size = get_viewport().get_visible_rect().size
	var screen_size_i = DisplayServer.screen_get_size()
	var safe_i = DisplayServer.get_display_safe_area()
	var left := 18.0
	var top := 16.0
	var right := 18.0
	var bottom := 16.0
	if screen_size_i.x > 0 and screen_size_i.y > 0 and safe_i.size.x > 0 and safe_i.size.y > 0:
		var sx = viewport_size.x / float(screen_size_i.x)
		var sy = viewport_size.y / float(screen_size_i.y)
		left += float(safe_i.position.x) * sx
		top += float(safe_i.position.y) * sy
		right += float(screen_size_i.x - safe_i.end.x) * sx
		bottom += float(screen_size_i.y - safe_i.end.y) * sy
	safe_root.offset_left = left
	safe_root.offset_top = top
	safe_root.offset_right = -right
	safe_root.offset_bottom = -bottom

func _unhandled_input(event: InputEvent) -> void:
	if state in [MenuState.MULTIPLAYER, MenuState.CHARACTER, MenuState.WORLD_SELECT, MenuState.SETTINGS] and event.is_action_pressed("ui_cancel"):
		_set_state(MenuState.MAIN_MENU)
		get_viewport().set_input_as_handled()
