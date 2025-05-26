Hooks.once("ready", async () => {
  const loopData = await loadLoopData();
  const originalPlay = foundry.audio.Sound.prototype.play;

  foundry.audio.Sound.prototype.play = async function (...args) {
    const result = await originalPlay.apply(this, args);
    console.log("[CustomLoops] Sound object debug", this);
    // Récupère le nom/chemin associé à ce son
    const src = this.src ?? "";
    const name = this._playlistSound?.name ?? src.split("/").pop();
    const meta = loopData[name];
    if (!meta) return result;
    // Attente active que la balise audio soit dispo
    let tries = 0;
    while (!this.element && tries < 20) {
      await new Promise((r) => setTimeout(r, 100));
      tries++;
    }
    const audio = this.element;
    if (!audio) {
      console.warn(`[CustomLoops] <audio> introuvable après 2s pour ${name}`);
      return result;
    }

    if (audio._customLoopPatched) return result;
    audio._customLoopPatched = true;
    const sampleRate = 44100; // ou détectable dynamiquement si besoin
    const loopStart = meta.loopStart / sampleRate;
    const loopEnd = meta.loopEnd / sampleRate;

    // Appliquer la logique de boucle arbitraire
    const onTimeUpdate = () => {
      if (audio.currentTime >= loopEnd) {
        audio.currentTime = loopStart;

        // Patch du timer visuel
        this.startTime = this.context.currentTime - loopStart;

        if (audio.paused) audio.play();
      }
    };

    const jumpToLoopStartOnce = () => {
      if (audio.currentTime < loopStart) {
        audio.currentTime = loopStart;
        this.startTime = this.context.currentTime - loopStart;
      }
      audio.removeEventListener("play", jumpToLoopStartOnce);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", jumpToLoopStartOnce);
    audio.addEventListener("ended", () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    });

    console.log(`[CustomLoops] Loop injecté dans Sound.play pour "${name}"`, {
      src,
      loopStart,
      loopEnd,
      tries,
    });

    return result;
  };
});

// Fonction de chargement du JSON
async function loadLoopData() {
  const path = game.settings.get("custom-loop-points", "loop-data-path"); // ← adapte à ton ID
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Loop JSON not found");
    const data = await response.json();
    console.log("[CustomLoops] Loop data loaded", data);
    return data;
  } catch (e) {
    ui.notifications?.warn(game.i18n.localize("CUSTOMLOOPS.LoopJsonNotFound"));
    console.error("[CustomLoops] Impossible de charger loop-data.json", e);
    return {};
  }
}
