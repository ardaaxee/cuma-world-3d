extends Node

var sun: DirectionalLight3D
var environment: Environment
var last_time = -100.0
var last_weather = ""

func setup(sun_node: DirectionalLight3D, env: Environment) -> void:
	sun = sun_node
	environment = env

func _process(_delta: float) -> void:
	if sun == null or environment == null:
		return
	var gs = get_node_or_null("/root/GameState")
	if gs == null:
		return
	var t = float(gs.time_of_day)
	var weather = str(gs.weather_mode).to_upper()
	if abs(t - last_time) < 0.01 and weather == last_weather:
		return
	last_time = t
	last_weather = weather
	_update_scene(t, weather)

func _update_scene(hour: float, weather_mode: String = "CLEAR") -> void:
	var daylight = clamp(sin(((hour - 6.0) / 12.0) * PI), 0.0, 1.0)
	var dusk = clamp(1.0 - abs(hour - 18.5) / 2.5, 0.0, 1.0)
	var night = 1.0 - daylight

	var sun_rotation = sun.rotation_degrees
	sun_rotation.x = -8.0 - daylight * 62.0
	sun_rotation.y = -145.0 + hour * 8.0
	sun.rotation_degrees = sun_rotation
	sun.light_energy = 0.05 + daylight * 1.38
	sun.light_color = Color("ffc98e").lerp(Color("fff5df"), clamp(daylight * 1.12, 0.0, 1.0))

	var night_bg = Color("07101d")
	var day_bg = Color("87b6dc")
	var sunset_bg = Color("c9775f")
	var bg = night_bg.lerp(day_bg, daylight)
	bg = bg.lerp(sunset_bg, dusk * 0.38)
	environment.background_color = bg
	environment.ambient_light_color = Color("283955").lerp(Color("d6e4ec"), daylight)
	environment.ambient_light_energy = 0.20 + daylight * 0.46 + night * 0.05
	environment.fog_light_color = bg.lerp(Color.WHITE, 0.16)

	match weather_mode:
		"RAIN":
			sun.light_energy *= 0.40
			environment.background_color = environment.background_color.lerp(Color("536274"), 0.58)
			environment.ambient_light_color = environment.ambient_light_color.lerp(Color("9aabba"), 0.58)
			environment.ambient_light_energy *= 0.72
			environment.fog_density = 0.010
		"CLOUDY":
			sun.light_energy *= 0.68
			environment.background_color = environment.background_color.lerp(Color("78889a"), 0.38)
			environment.ambient_light_energy *= 0.84
			environment.fog_density = 0.005
		_:
			environment.fog_density = 0.0015

	_update_practical_lights(daylight)

func _update_practical_lights(daylight: float) -> void:
	var night_strength = clamp(1.0 - daylight * 0.92, 0.12, 1.0)
	for node in get_tree().get_nodes_in_group("aaa_practical_light"):
		if not (node is Light3D):
			continue
		if not node.has_meta("aaa_base_energy"):
			node.set_meta("aaa_base_energy", node.light_energy)
		var base_energy = float(node.get_meta("aaa_base_energy", node.light_energy))
		node.light_energy = base_energy * night_strength
