extends RefCounted

# Shared, deterministic meshes: no per-frame geometry work or extra draw calls.
static var _cache: Dictionary = {}

static func create(size: Vector3, requested_radius: float = 0.012) -> ArrayMesh:
	var radius = minf(requested_radius, minf(size.x, minf(size.y, size.z)) * 0.2)
	assert(radius > 0.0)
	var key = Vector4(size.x, size.y, size.z, radius)
	if _cache.has(key):
		return _cache[key]
	var half = size * 0.5
	var inner = half - Vector3.ONE * radius
	var surface = SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	# u cross v points outwards. Godot front faces use clockwise winding.
	for axes in [[Vector3.RIGHT, Vector3.UP, Vector3.BACK],
		[Vector3.LEFT, Vector3.UP, Vector3.FORWARD],
		[Vector3.UP, Vector3.BACK, Vector3.RIGHT],
		[Vector3.DOWN, Vector3.BACK, Vector3.LEFT],
		[Vector3.BACK, Vector3.RIGHT, Vector3.UP],
		[Vector3.FORWARD, Vector3.RIGHT, Vector3.DOWN]]:
		var normal: Vector3 = axes[0]
		var u: Vector3 = axes[1]
		var v: Vector3 = axes[2]
		var hu = half.dot(u.abs())
		var hv = half.dot(v.abs())
		var us = [-hu, -hu + radius, hu - radius, hu]
		var vs = [-hv, -hv + radius, hv - radius, hv]
		var origin = normal * half.dot(normal.abs())
		for row in range(3):
			for column in range(3):
				var points = [origin + u * us[column] + v * vs[row],
					origin + u * us[column + 1] + v * vs[row],
					origin + u * us[column + 1] + v * vs[row + 1],
					origin + u * us[column] + v * vs[row + 1]]
				for index in [0, 2, 1, 0, 3, 2]:
					var point: Vector3 = points[index]
					var center = point.clamp(-inner, inner)
					var rounded_normal = (point - center).normalized()
					surface.set_normal(rounded_normal)
					surface.set_uv(Vector2(point.dot(u) / (2.0 * hu) + 0.5, point.dot(v) / (2.0 * hv) + 0.5))
					surface.add_vertex(center + rounded_normal * radius)
	surface.index()
	var mesh = surface.commit()
	_cache[key] = mesh
	return mesh
