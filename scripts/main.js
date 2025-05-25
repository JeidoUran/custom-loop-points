// === Custom Looping for FoundryVTT Music ===

// Utilitaire : cache sampleRate pour éviter de re-décoder le même fichier
const _sampleRateCache = {};

// Utilitaire pour obtenir la sampleRate réelle d'un fichier audio (via AudioContext)
async function getSampleRate(url) {
  if (_sampleRateCache[url]) return _sampleRateCache[url];
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new window.AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    _sampleRateCache[url] = audioBuffer.sampleRate;
    return audioBuffer.sampleRate;
  } catch (e) {
    console.error(`[CustomLoops] Could not read sampleRate for ${url}`, e);
    return 44100; // Fallback : 44.1kHz (standard)
  }
}

// Utilitaire : charge le JSON de boucles à l'URL du setting
async function loadLoopData() {
  const path = game.settings.get("custom-loop-points", "loop-data-path"); // <- adapte à ton id
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

// PATCH PRINCIPAL : attache le contrôle de bouclage sur chaque audio joué
async function patchAudioLoopingForSound(sound, loopData) {
  if (!sound?.src) return;
  // Cherche le nom du fichier (adapter selon ta structure JSON, ici on prend juste le nom)
  const src = sound.src.split("/").pop();
  const meta = loopData[src];
  if (!meta) return; // pas de boucle custom pour ce fichier

  // Récupère la fréquence d'échantillonnage (une fois par session par fichier)
  const sampleRate = await getSampleRate(sound.src);

  // Conversion samples → secondes
  const loopStart = meta.loopStart / sampleRate;
  const loopEnd = meta.loopEnd / sampleRate;

  // Trouve l'audio HTML5
  const audio =
    sound.sound?.howl?._sounds?.[0]?._node ||
    document.querySelector(`audio[src*="${src}"]`);
  if (!audio) return;

  // Patch de protection : ne patch qu'une seule fois
  if (audio._customLoopPatched) return;
  audio._customLoopPatched = true;

  // Ajoute le loop custom
  const handler = function () {
    if (audio.currentTime >= loopEnd) {
      audio.currentTime = loopStart;
      audio.play();
    }
  };
  audio.addEventListener("timeupdate", handler);

  // Au tout premier play, saute à loopStart si on part du début
  const jumpToLoopStartOnce = function () {
    if (audio.currentTime < loopStart) {
      audio.currentTime = loopStart;
    }
    audio.removeEventListener("play", jumpToLoopStartOnce);
  };
  audio.addEventListener("play", jumpToLoopStartOnce);

  // Nettoyage quand le son s'arrête (optionnel)
  audio.addEventListener("ended", () => {
    audio.removeEventListener("timeupdate", handler);
  });
}

// === HOOKS ===
let _loopData = {};

Hooks.once("ready", async () => {
  _loopData = await loadLoopData();

  // Surveille chaque son joué depuis une playlist
  Hooks.on("preCreateSound", (sound) => {
    setTimeout(() => patchAudioLoopingForSound(sound, _loopData), 500);
  });

  // Patch les musiques déjà en cours de lecture (ex: reload module)
  for (let s of Object.values(game.playlists?.playing ?? {})) {
    patchAudioLoopingForSound(s, _loopData);
  }

  // Optionnel : commande reload en live (par exemple via console ou macro)
  game.customLoops = {
    async reload() {
      _loopData = await loadLoopData();
      ui.notifications?.info("Loop data reloaded!");
      // Patch les musiques actives si besoin :
      for (let s of Object.values(game.playlists?.playing ?? {})) {
        patchAudioLoopingForSound(s, _loopData);
      }
    },
  };
});
