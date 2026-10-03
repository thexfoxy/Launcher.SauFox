# SauFox launcher SDK for Godot 4. Add as an Autoload named "SauFox".
#
#   SauFox.unlock("first_steps")      # unlock an achievement
#   var dir = SauFox.save_dir()       # write your save files here
#
# Started any other way than from the launcher, achievements are skipped
# quietly and saves go to user://saves, so the game always runs.
extends Node

var _url := OS.get_environment("SAUFOX_SDK_URL")
var _token := OS.get_environment("SAUFOX_SDK_TOKEN")

func available() -> bool:
	return _url != "" and _token != ""

func save_dir() -> String:
	var dir := OS.get_environment("SAUFOX_SAVE_DIR")
	if dir == "":
		dir = ProjectSettings.globalize_path("user://saves")
	DirAccess.make_dir_recursive_absolute(dir)
	return dir

func unlock(key: String) -> void:
	if not available():
		return
	var req := HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_r, _c, _h, _b): req.queue_free())
	req.request(_url + "/v1/achievements/unlock",
		["Content-Type: application/json", "Authorization: Bearer " + _token],
		HTTPClient.METHOD_POST, JSON.stringify({"key": key}))
