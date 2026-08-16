export function createAudio(deps) {
  let audioContext = null;
  let music = null;
  let musicTimer = 0;

  function getAudioContext() {
    if (!deps.getAudioEnabled()) return null;
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration = 0.1, type = "sine", volume = 0.05, offset = 0) {
    const ac = getAudioContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime + offset;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function sound(name) {
    if (!deps.getAudioEnabled()) return;
    if (name === "click") {
      tone(420, .06, "triangle", .035);
    } else if (name === "coin") {
      tone(760, .08, "sine", .055);
      tone(1060, .11, "sine", .045, .05);
    } else if (name === "deliver") {
      tone(520, .10, "triangle", .06);
      tone(700, .12, "triangle", .06, .08);
      tone(920, .18, "triangle", .055, .16);
    } else if (name === "crash") {
      tone(150, .16, "sawtooth", .065);
      tone(90, .22, "square", .035, .04);
    } else if (name === "slip") {
      tone(620, .08, "triangle", .045);
      tone(360, .18, "sawtooth", .035, .07);
      tone(180, .16, "sine", .04, .18);
    } else if (name === "storm") {
      [660, 880, 740, 980].forEach((f, i) => tone(f, .08, "square", .026, i * .07));
      tone(520, .16, "triangle", .018, .28);
    } else if (name === "win") {
      [520, 660, 780, 1040].forEach((f, i) => tone(f, .24, "triangle", .05, i * .11));
    } else if (name === "lose") {
      [300, 245, 190].forEach((f, i) => tone(f, .25, "sine", .05, i * .15));
    }
  }

  function scheduleMusicNote(ac, frequency, start, duration, volume, type = "triangle") {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + .04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(music.gain);
    osc.start(start);
    osc.stop(start + duration + .04);
  }

  function scheduleMusicBar() {
    if (!music || !deps.getAudioEnabled()) return;
    const levelData = deps.getLevelData();
    const ac = music.context;
    const phraseStart = ac.currentTime + .04;
    const night = levelData.theme === "night";
    const bass = night
      ? [87.31, 98, 110, 82.41, 98, 130.81, 110, 73.42]
      : [130.81, 164.81, 146.83, 196];
    const lead = night
      ? [293.66, 329.63, 392, 349.23, 440, 392, 329.63, 261.63, 293.66, 349.23, 493.88, 440]
      : [523.25, 659.25, 587.33, 783.99];
    const bar = night ? 1.96 : 2.4;
    const barsToSchedule = night ? 4 : 1;
    for (let barIndex = 0; barIndex < barsToSchedule; barIndex++) {
      const start = phraseStart + barIndex * bar;
      const step = music.step + barIndex;
      const root = bass[step % bass.length];
      scheduleMusicNote(ac, root, start, night ? 1.18 : 1.05, night ? .043 : .035, "sine");
      scheduleMusicNote(ac, root / 2, start, night ? 1.5 : 1.5, night ? .03 : .026, "triangle");
      for (let i = 0; i < (night ? 5 : 5); i++) {
        const offset = night ? .22 + i * .31 : .28 + i * .38;
        const note = lead[(step * 3 + i) % lead.length];
        scheduleMusicNote(ac, note, start + offset, night ? .13 : .16, night ? .016 : .022, "triangle");
      }
      if (night) {
        [0, .49, .98, 1.47].forEach((offset, i) => {
          scheduleMusicNote(ac, i % 2 ? 130.81 : 174.61, start + offset, .095, .016, "triangle");
        });
        const accent = lead[(step * 5 + 7) % lead.length] * 1.5;
        scheduleMusicNote(ac, accent, start + 1.72, .07, .009, "sine");
      }
    }
    music.step += barsToSchedule;
    musicTimer = window.setTimeout(scheduleMusicBar, bar * barsToSchedule * 1000);
  }

  function startBackgroundMusic() {
    if (!deps.getAudioEnabled() || music) return;
    const levelData = deps.getLevelData();
    const ac = getAudioContext();
    if (!ac) return;
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(levelData.theme === "night" ? 1050 : 1450, ac.currentTime);
    gain.gain.setValueAtTime(0.001, ac.currentTime);
    gain.gain.linearRampToValueAtTime(levelData.theme === "night" ? .44 : .32, ac.currentTime + .8);
    filter.connect(gain);
    gain.connect(ac.destination);
    music = { context: ac, gain: filter, master: gain, step: 0 };
    scheduleMusicBar();
  }

  function stopBackgroundMusic() {
    if (musicTimer) {
      window.clearTimeout(musicTimer);
      musicTimer = 0;
    }
    if (music) {
      const ac = music.context;
      music.master.gain.cancelScheduledValues(ac.currentTime);
      music.master.gain.setTargetAtTime(0.001, ac.currentTime, .08);
      const master = music.master;
      window.setTimeout(() => master.disconnect(), 220);
      music = null;
    }
  }

  function setMusicPaused(paused) {
    if (!music) return;
    const levelData = deps.getLevelData();
    const ac = music.context;
    music.master.gain.cancelScheduledValues(ac.currentTime);
    music.master.gain.setTargetAtTime(paused ? 0.001 : levelData.theme === "night" ? .44 : .32, ac.currentTime, .12);
  }

  return {
    getAudioContext,
    sound,
    startBackgroundMusic,
    stopBackgroundMusic,
    setMusicPaused
  };
}
