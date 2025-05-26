Hooks.once("ready", async () => {
  const loopData = await loadLoopData();
  const originalPlay = foundry.audio.Sound.prototype.play;

  foundry.audio.Sound.prototype.play = async function (...args) {
    const result = await originalPlay.apply(this, args);

    const src = this.src ?? "";
    const name = this._playlistSound?.name ?? src.split("/").pop();
    const meta = loopData[name];
    if (!meta) return result;

    const sampleRate = 44100;
    const loopStart = meta.loopStart / sampleRate;
    const loopEnd = meta.loopEnd / sampleRate;

    const node = this.node;

    if (node instanceof AudioBufferSourceNode) {
      node.loop = true;
      node.loopStart = loopStart;
      node.loopEnd = loopEnd;

      console.log(
        `[CustomLoops] Injected AudioBufferSourceNode loop for "${name}"`,
        {
          loopStart,
          loopEnd,
          sampleRate,
        }
      );

      // Timer patch
      const context = this.context;
      const fixTimer = () => {
        if (context?.currentTime && this.startTime !== undefined) {
          this.startTime = context.currentTime - loopStart;
          console.log(`[CustomLoops] Re-sync timer for "${name}"`);
        }
      };

      const checkLoop = () => {
        const interval = setInterval(() => {
          const current = context.currentTime - this.startTime;
          if (current >= loopEnd) {
            fixTimer();
            clearInterval(interval);
          }
        }, 100);
      };

      checkLoop();
    }

    return result;
  };
});

// Function to laod JSON
async function loadLoopData() {
  const path = game.settings.get("custom-loop-points", "loop-data-path");
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Loop JSON not found");
    const data = await response.json();
    console.log("[CustomLoops] Loop data loaded", data);
    return data;
  } catch (e) {
    ui.notifications?.warn(game.i18n.localize("CUSTOMLOOPS.LoopJsonNotFound"));
    console.error("[CustomLoops] Could not load JSON loop data file", e);
    return {};
  }
}
