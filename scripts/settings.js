Hooks.once("init", () => {
  game.settings.register("custom-loop-points", "loop-data-path", {
    name: "CUSTOMLOOPS.Settings.JsonDataPath.Name",
    hint: "CUSTOMLOOPS.Settings.JsonDataPath.Hint",
    scope: "world",
    config: true,
    type: String,
    filePicker: "any",
    default: "./modules/custom-loop-points/loop-data.json",
  });
});
