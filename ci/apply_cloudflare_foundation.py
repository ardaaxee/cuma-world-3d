#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1] / "game"
OVERLAY = Path(__file__).resolve().parent / "overlays" / "cloudflare_control_plane.gd"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"CLOUDFLARE PATCH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"CLOUDFLARE PATCH APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")
    if not OVERLAY.is_file():
        raise SystemExit(f"missing Cloudflare overlay: {OVERLAY}")

    target = ROOT / "scripts" / "cloudflare_control_plane.gd"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OVERLAY, target)
    print("CLOUDFLARE PATCH APPLIED: install control-plane client")

    project = ROOT / "project.godot"
    replace_exact(
        project,
        'NetworkManager="*res://scripts/network_manager.gd"\nStoryManager="*res://scripts/story/story_manager.gd"',
        'NetworkManager="*res://scripts/network_manager.gd"\nCloudflareControlPlane="*res://scripts/cloudflare_control_plane.gd"\nStoryManager="*res://scripts/story/story_manager.gd"',
        "register CloudflareControlPlane autoload",
    )
    replace_exact(
        project,
        '[rendering]\n',
        '[network]\ncloudflare_control_plane_url=""\n\n[rendering]\n',
        "add optional Cloudflare control-plane URL project setting",
    )

    network = ROOT / "scripts" / "network_manager.gd"
    replace_exact(
        network,
        'var auth_failures_in_window = 0\n\nfunc _ready() -> void:',
        'var auth_failures_in_window = 0\nvar pending_cloud_lookup_code = ""\n\nfunc _ready() -> void:',
        "track pending Cloudflare room lookup",
    )
    replace_exact(
        network,
        '\tmultiplayer.server_disconnected.connect(_on_server_disconnected)\n\nfunc host_lan',
        '\tmultiplayer.server_disconnected.connect(_on_server_disconnected)\n\tvar cloud = get_node_or_null("/root/CloudflareControlPlane")\n\tif cloud != null and cloud.has_signal("room_lookup_result"):\n\t\tcloud.connect("room_lookup_result", Callable(self, "_on_cloud_room_lookup_result"))\n\nfunc join_cloud_room(invite_code: String) -> int:\n\tvar code = _sanitize_session_code(invite_code)\n\tif code.length() != SESSION_CODE_LENGTH:\n\t\t_set_status("6 HANELİ KOD GEREKLİ")\n\t\treturn ERR_INVALID_PARAMETER\n\tvar cloud = get_node_or_null("/root/CloudflareControlPlane")\n\tif cloud == null or not cloud.has_method("lookup_room") or not bool(cloud.call("is_configured")):\n\t\t_set_status("CLOUD ODA SERVİSİ AYARLI DEĞİL")\n\t\treturn ERR_UNAVAILABLE\n\tpending_cloud_lookup_code = code\n\t_set_status("CLOUD ODA ARANIYOR")\n\tvar err = int(cloud.call("lookup_room", code))\n\tif err != OK:\n\t\tpending_cloud_lookup_code = ""\n\t\t_set_status("CLOUD ODA SORGUSU BAŞLAMADI")\n\treturn err\n\nfunc _on_cloud_room_lookup_result(ok: bool, relay_url: String, message: String) -> void:\n\tvar code = pending_cloud_lookup_code\n\tpending_cloud_lookup_code = ""\n\tif not ok or code.length() != SESSION_CODE_LENGTH:\n\t\t_set_status(message.left(64) if not message.is_empty() else "ODA BULUNAMADI")\n\t\treturn\n\tjoin_relay(relay_url, code)\n\nfunc host_lan',
        "add Cloudflare room-code discovery join flow",
    )
    replace_exact(
        network,
        '\tknown_authorized_peers.clear()\n\tauth_failures_by_peer.clear()',
        '\tknown_authorized_peers.clear()\n\tpending_cloud_lookup_code = ""\n\tauth_failures_by_peer.clear()',
        "clear pending Cloudflare lookup on network stop",
    )

    dedicated = ROOT / "server" / "dedicated_server.gd"
    replace_exact(
        dedicated,
        'const AUTOSAVE_SECONDS := 60.0\n\nvar autosave_accum = 0.0',
        'const AUTOSAVE_SECONDS := 60.0\nconst CONTROL_HEARTBEAT_SECONDS := 45.0\n\nvar autosave_accum = 0.0\nvar control_heartbeat_accum = 0.0\nvar registered_room_code = ""\nvar cloud_public_relay_url = ""',
        "add dedicated Cloudflare room heartbeat state",
    )
    replace_exact(
        dedicated,
        '\tvar port = DEFAULT_PORT\n\tvar room_code = ""\n\tfor arg in OS.get_cmdline_user_args():',
        '\tvar port = DEFAULT_PORT\n\tvar room_code = ""\n\tcloud_public_relay_url = OS.get_environment("CUMA_PUBLIC_RELAY_URL").strip_edges()\n\tfor arg in OS.get_cmdline_user_args():',
        "read dedicated public relay URL from environment",
    )
    replace_exact(
        dedicated,
        '\t\telif arg.begins_with("--room="):\n\t\t\troom_code = arg.trim_prefix("--room=")',
        '\t\telif arg.begins_with("--room="):\n\t\t\troom_code = arg.trim_prefix("--room=")\n\t\telif arg.begins_with("--public-url="):\n\t\t\tcloud_public_relay_url = arg.trim_prefix("--public-url=").strip_edges()',
        "accept dedicated --public-url override",
    )
    replace_exact(
        dedicated,
        '\tprint("CUMA WORLD 1.8 DEDICATED READY • PORT %d • ROOM %s" % [port, net.session_code])',
        '\t_register_cloud_room()\n\tprint("CUMA WORLD PRODUCTION DEDICATED READY • PORT %d • ROOM %s" % [port, net.session_code])',
        "register dedicated room with Cloudflare control plane",
    )
    replace_exact(
        dedicated,
        '\tif autosave_accum >= AUTOSAVE_SECONDS:\n\t\tautosave_accum = 0.0\n\t\t_save_server_state()\n\nfunc _exit_tree() -> void:\n\t_save_server_state()',
        '\tif autosave_accum >= AUTOSAVE_SECONDS:\n\t\tautosave_accum = 0.0\n\t\t_save_server_state()\n\tcontrol_heartbeat_accum += delta\n\tif control_heartbeat_accum >= CONTROL_HEARTBEAT_SECONDS:\n\t\tcontrol_heartbeat_accum = 0.0\n\t\t_heartbeat_cloud_room()\n\nfunc _exit_tree() -> void:\n\t_unregister_cloud_room()\n\t_save_server_state()',
        "heartbeat and cleanup Cloudflare room registration",
    )
    replace_exact(
        dedicated,
        'func _save_server_state() -> void:\n\tvar gs = get_node_or_null("/root/GameState")',
        'func _register_cloud_room() -> void:\n\tif not cloud_public_relay_url.begins_with("wss://"):\n\t\treturn\n\tvar control = get_node_or_null("/root/CloudflareControlPlane")\n\tvar net = get_node_or_null("/root/NetworkManager")\n\tif control == null or net == null or not control.has_method("register_room") or not bool(control.call("is_configured")):\n\t\treturn\n\tregistered_room_code = str(net.session_code)\n\tvar region = OS.get_environment("CUMA_REGION").strip_edges().left(24)\n\tvar err = int(control.call("register_room", registered_room_code, cloud_public_relay_url, "3.0-dev", region))\n\tif err != OK:\n\t\tpush_warning("Cloudflare room registration could not start: %d" % err)\n\nfunc _heartbeat_cloud_room() -> void:\n\tif registered_room_code.is_empty():\n\t\treturn\n\tvar control = get_node_or_null("/root/CloudflareControlPlane")\n\tif control == null or not control.has_method("heartbeat_room"):\n\t\treturn\n\tif control.has_method("is_busy") and bool(control.call("is_busy")):\n\t\treturn\n\tcontrol.call("heartbeat_room", registered_room_code)\n\nfunc _unregister_cloud_room() -> void:\n\tif registered_room_code.is_empty():\n\t\treturn\n\tvar control = get_node_or_null("/root/CloudflareControlPlane")\n\tif control != null and control.has_method("unregister_room") and (not control.has_method("is_busy") or not bool(control.call("is_busy"))):\n\t\tcontrol.call("unregister_room", registered_room_code)\n\tregistered_room_code = ""\n\nfunc _save_server_state() -> void:\n\tvar gs = get_node_or_null("/root/GameState")',
        "add dedicated Cloudflare room lifecycle helpers",
    )

    # No secret may be embedded into source or project settings. Dedicated servers
    # read CUMA_CONTROL_TOKEN from the environment only.
    combined = "\n".join([
        target.read_text(encoding="utf-8"),
        network.read_text(encoding="utf-8"),
        dedicated.read_text(encoding="utf-8"),
        project.read_text(encoding="utf-8"),
    ])
    forbidden = ["CONTROL_TOKEN=", "RATE_HASH_SECRET=", "Bearer sk-", "Bearer cf-"]
    for marker in forbidden:
        if marker in combined:
            raise SystemExit(f"Cloudflare secret-like value must not be committed: {marker}")

    print("CLOUDFLARE FOUNDATION PATCH: PASS")


if __name__ == "__main__":
    main()
