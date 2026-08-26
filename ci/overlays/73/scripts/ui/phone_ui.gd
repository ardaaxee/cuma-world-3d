extends CanvasLayer

var panel: PanelContainer
var info: Label
var weather_button: Button
var open = false
var refresh_accum = 0.0
var phone_mode = "HOME"
const REFRESH_INTERVAL := 0.25

func setup() -> void:
	layer = 35
	_build_ui()
	set_process(true)

func _process(delta: float) -> void:
	if Input.is_key_pressed(KEY_P) and not get_meta("p_down", false):
		set_meta("p_down", true)
		_toggle()
	elif not Input.is_key_pressed(KEY_P):
		set_meta("p_down", false)
	if open:
		refresh_accum += delta
		if refresh_accum >= REFRESH_INTERVAL:
			refresh_accum = 0.0
			_refresh()

func _build_ui() -> void:
	var open_button = Button.new()
	open_button.text = "PHONE"
	open_button.anchor_left = 1.0
	open_button.anchor_right = 1.0
	open_button.offset_left = -118
	open_button.offset_right = -20
	open_button.offset_top = 20
	open_button.offset_bottom = 58
	open_button.pressed.connect(_toggle)
	add_child(open_button)
	panel = PanelContainer.new()
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -365
	panel.offset_right = -20
	panel.offset_top = 68
	panel.offset_bottom = 690
	panel.visible = false
	add_child(panel)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 9)
	panel.add_child(box)
	var title = Label.new()
	title.text = "CUMA PHONE"
	title.add_theme_font_size_override("font_size", 22)
	box.add_child(title)
	info = Label.new()
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(315, 155)
	box.add_child(info)
	var intel_tabs = GridContainer.new()
	intel_tabs.columns = 4
	intel_tabs.add_theme_constant_override("h_separation", 4)
	box.add_child(intel_tabs)
	for tab in [["ANA", "HOME"], ["MİSYON", "MISSIONS"], ["INTEL", "INTEL"], ["HARİTA", "MAP"]]:
		var tab_button = Button.new()
		tab_button.text = str(tab[0])
		tab_button.custom_minimum_size = Vector2(72, 34)
		tab_button.pressed.connect(_set_phone_mode.bind(str(tab[1])))
		intel_tabs.add_child(tab_button)
	weather_button = Button.new()
	weather_button.text = "HAVAYI DEĞİŞTİR"
	weather_button.pressed.connect(_cycle_weather)
	box.add_child(weather_button)
	var social = Button.new()
	social.text = "SOSYAL • KOMŞULAR / ARKADAŞLAR"
	social.pressed.connect(_open_social)
	box.add_child(social)
	for item in [["PARTNERE: BURAYA GEL", "Buraya gel"], ["PARTNERE: HAZIRIM", "Hazırım"], ["FİLM TEKLİF ET", "Film?"], ["FOTOĞRAF TEKLİF ET", "Fotoğraf?"]]:
		var b = Button.new()
		b.text = item[0]
		b.pressed.connect(_quick.bind(item[1]))
		box.add_child(b)
	var save = Button.new()
	save.text = "OYUNU KAYDET"
	save.pressed.connect(_save)
	box.add_child(save)
	var close = Button.new()
	close.text = "KAPAT"
	close.pressed.connect(_toggle)
	box.add_child(close)

func _toggle() -> void:
	open = not open
	if panel != null:
		panel.visible = open
	if open:
		refresh_accum = 0.0
		_refresh()

func _refresh() -> void:
	var gs = get_node_or_null("/root/GameState")
	var net = get_node_or_null("/root/NetworkManager")
	var weather = get_tree().get_first_node_in_group("weather_manager")
	if gs == null or info == null:
		return
	if phone_mode != "HOME":
		_refresh_intelligence_phone()
		return
	var w = weather.get_weather_label() if weather != null and weather.has_method("get_weather_label") else "AÇIK"
	var net_text = net.status if net != null else "OFFLINE"
	var memories = "Henüz anı yok"
	if gs.duo_memories.size() > 0:
		memories = str(gs.duo_memories[0])
	var story = get_node_or_null("/root/StoryManager")
	var story_title = story.get_story_title() if story != null else "CUMA WORLD"
	var story_goal = story.get_story_objective() if story != null else gs.objective
	var item_count = 0
	for key in gs.inventory.keys():
		item_count += int(gs.inventory[key])
	var social_summary = gs.get_social_summary() if gs.has_method("get_social_summary") else "Sosyal sistem kapalı"
	var calendar_summary = gs.get_social_calendar_summary() if gs.has_method("get_social_calendar_summary") else "Takvim boş"
	var human_director = get_tree().get_first_node_in_group("human_behavior_director")
	var crowd_summary = human_director.get_crowd_summary() if human_director != null and human_director.has_method("get_crowd_summary") else "Normal"
	var daily_director = get_tree().get_first_node_in_group("daily_life_director")
	var daily_summary = daily_director.get_daily_summary() if daily_director != null and daily_director.has_method("get_daily_summary") else (gs.get_daily_life_summary() if gs.has_method("get_daily_life_summary") else "Günlük yaşam akışı sakin")
	var weekday = gs.get_weekday_name() if gs.has_method("get_weekday_name") else "Gün"
	var society_director = get_tree().get_first_node_in_group("city_society_director")
	var society_summary = society_director.get_city_society_summary() if society_director != null and society_director.has_method("get_city_society_summary") else "Şehir normal akışında"
	var dynamic_director = get_tree().get_first_node_in_group("dynamic_city_director")
	var dynamic_summary = dynamic_director.get_dynamic_city_summary() if dynamic_director != null and dynamic_director.has_method("get_dynamic_city_summary") else "Şehir merkezi normal"
	var career_summary = gs.get_career_summary() if gs.has_method("get_career_summary") else "Kariyer yok"
	var hair_summary = gs.get_hair_style_name() if gs.has_method("get_hair_style_name") else "Doğal"
	var law_summary = gs.get_law_summary() if gs.has_method("get_law_summary") else "Yasal durum normal"
	var cyber_summary = gs.get_cyber_summary() if gs.has_method("get_cyber_summary") else "Cyber kapalı"
	var stolen_count = 0
	for key in gs.stolen_goods.keys():
		var entry: Variant = gs.stolen_goods[key]
		if entry is Dictionary:
			stolen_count += int(entry.get("count", 0))
	info.text = "%s • Gün %d • Saat %02d:%02d  •  %s\nŞehir akışı: %s\nŞehir etkinliği: %s\nMerkez: %s\nGünlük yaşam: %s\n₺%d • Envanter %d eşya\nKariyer: %s\nYasa: %s\nCyber: %s • Riskli eşya %d\n%s\n%s\nPartner: %s\nDUO: %d • %s\nSosyal: %s\nTakvim: %s\nStil: %s / %s • Saç: %s\nSon anı: %s\n\nŞebeke: %s" % [weekday, gs.world_day, int(gs.time_of_day), int(fmod(gs.time_of_day,1.0)*60.0), w, crowd_summary, society_summary, dynamic_summary, daily_summary, gs.money, item_count, career_summary, law_summary, cyber_summary, stolen_count, story_title, story_goal, gs.partner_name, gs.duo_points, gs.get_duo_rank(), social_summary, calendar_summary, gs.get_character_style_name(), gs.selected_outfit, hair_summary, memories, net_text]

func _set_phone_mode(value: String) -> void:
	phone_mode = value if value in ["HOME", "MISSIONS", "INTEL", "MAP"] else "HOME"
	refresh_accum = 0.0
	_refresh()

func _refresh_intelligence_phone() -> void:
	if info == null:
		return
	var mission = get_tree().get_first_node_in_group("mission_system")
	var intel = get_tree().get_first_node_in_group("intel_system")
	if phone_mode == "MISSIONS":
		if mission == null or not mission.has_method("get_active_summary"):
			info.text = "MISSIONS\nAktif görev yok."
			return
		var summary: Dictionary = mission.call("get_active_summary")
		var lines: Array[String] = ["MISSIONS  •  %s" % str(summary.get("title", "MISSION")), "%s  •  %s" % [str(summary.get("location", "")), str(summary.get("state", ""))], "", "PRIMARY", str(summary.get("primary", "")), "", "OPTIONAL"]
		for entry in summary.get("optional", []):
			if entry is Dictionary:
				lines.append("%s  %s" % ["✓" if bool(entry.get("complete", false)) else "○", str(entry.get("title", ""))])
		lines.append("")
		lines.append("KNOWN INTEL %d  •  UNKNOWN %d" % [int(summary.get("known_intel", 0)), int(summary.get("unknown_intel", 0))])
		lines.append("ALERT %d  •  CCTV %d" % [int(summary.get("alerts", 0)), int(summary.get("camera_detections", 0))])
		var routes: Array = summary.get("known_routes", [])
		var route_titles: Array[String] = []
		for route in routes:
			if route is Dictionary:
				route_titles.append(str(route.get("title", "")))
		lines.append("ROUTES  " + (" / ".join(route_titles) if not route_titles.is_empty() else "Henüz keşfedilmedi"))
		info.text = "\n".join(lines)
		return
	if phone_mode == "INTEL":
		if intel == null or not intel.has_method("get_board_sections"):
			info.text = "INTEL\nIntel sistemi hazır değil."
			return
		var sections: Dictionary = intel.call("get_board_sections")
		var lines: Array[String] = ["INTEL BOARD"]
		for section in ["PEOPLE", "PLACES", "CLUES", "ROUTES", "OBJECTIVES"]:
			lines.append("")
			lines.append(section)
			var values: Array = sections.get(section, [])
			if values.is_empty():
				lines.append("—")
				continue
			for entry in values:
				if entry is Dictionary:
					var relation_text = ""
					if intel.has_method("get_connections"):
						var links: Array = intel.call("get_connections", str(entry.get("id", "")), true)
						if not links.is_empty():
							relation_text = "  ↳ " + str(links[0].get("title", ""))
					lines.append("• %s%s" % [str(entry.get("title", "")), relation_text])
		info.text = "\n".join(lines)
		return
	if phone_mode == "MAP":
		if intel == null or not intel.has_method("get_known_map_markers"):
			info.text = "SAHA HARİTASI\nKeşfedilmiş saha verisi yok."
			return
		var mission_id = ""
		if mission != null and mission.has_method("get_active_summary"):
			mission_id = str(mission.call("get_active_summary").get("id", ""))
		var markers: Array = intel.call("get_known_map_markers", mission_id)
		var lines: Array[String] = ["SAHA HARİTASI  •  yalnız keşfedilen veriler", ""]
		if markers.is_empty():
			lines.append("Henüz harita işareti yok.")
		else:
			for marker in markers:
				if marker is Dictionary and marker.get("position", null) is Vector3:
					var pos: Vector3 = marker.get("position")
					lines.append("• %s  [%s]  x%.0f z%.0f" % [str(marker.get("title", "")), str(marker.get("category", "")), pos.x, pos.z])
		info.text = "\n".join(lines)

func _cycle_weather() -> void:
	var weather = get_tree().get_first_node_in_group("weather_manager")
	if weather != null and weather.has_method("cycle_weather"):
		weather.cycle_weather()
	_refresh()

func _quick(message: String) -> void:
	var net = get_node_or_null("/root/NetworkManager")
	if net != null and net.has_method("send_quick_message"):
		net.send_quick_message(message)

func _save() -> void:
	var player = get_tree().get_first_node_in_group("player")
	if player != null and player.has_method("save_now"):
		player.save_now()

func _open_social() -> void:
	var nodes = get_tree().get_nodes_in_group("social_ui")
	if nodes.size() > 0 and nodes[0].has_method("open_contacts"):
		nodes[0].open_contacts()
