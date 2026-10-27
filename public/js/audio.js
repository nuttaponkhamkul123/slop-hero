// Procedural Web Audio Engine for Aetheria Online

// Background music per screen / zone (served by server/index.js)
const BGM_TRACKS = {
  login: '/login.wav',
  town: '/city.wav',
  dungeon: '/dunjion.wav',
  frostfell: '/frosfell.wav',
  shadowfell: '/shadowfell-ruins.wav'
};
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmVolume = parseFloat(localStorage.getItem('slop_bgm_vol') || '0.6');
    this.sfxVolume = parseFloat(localStorage.getItem('slop_sfx_vol') || '0.7');
    this.masterGain = null;
    this.bgmTracks = {};
    this.currentZone = 'login';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  get dest() {
    return this.masterGain || (this.ctx ? this.ctx.destination : null);
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, parseFloat(val)));
    localStorage.setItem('slop_bgm_vol', this.bgmVolume.toString());
    for (const audio of Object.values(this.bgmTracks)) {
      audio.volume = this.muted ? 0 : this.bgmVolume;
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, parseFloat(val)));
    localStorage.setItem('slop_sfx_vol', this.sfxVolume.toString());
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopAllBgm();
    } else {
      this.updateZoneBgm(this.currentZone);
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.ctx.currentTime);
    }
    return this.muted;
  }

  // Play one looping BGM track (key of BGM_TRACKS), pausing all others
  playBgm(key) {
    for (const [k, audio] of Object.entries(this.bgmTracks)) {
      if (k !== key) audio.pause();
    }
    if (this.muted || !BGM_TRACKS[key]) return;
    if (!this.bgmTracks[key]) {
      const audio = new Audio(BGM_TRACKS[key]);
      audio.loop = true;
      audio.volume = this.bgmVolume;
      this.bgmTracks[key] = audio;
    }
    if (this.bgmTracks[key].paused) {
      this.bgmTracks[key].play().catch(() => {});
    }
  }

  stopAllBgm() {
    for (const audio of Object.values(this.bgmTracks)) {
      audio.pause();
    }
  }

  // zone: 'login', 'town', 'dungeon', or a field zone id (e.g. 'shadowfell')
  updateZoneBgm(zone) {
    this.currentZone = zone;
    if (BGM_TRACKS[zone]) {
      this.playBgm(zone);
    } else {
      this.stopAllBgm();
    }
  }

  // Melee Sword Swing / Slash (Punchy & Meatier)
  playSlash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. High frequency blade whoosh
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(620, t);
    osc1.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    osc1.connect(gain1);
    gain1.connect(this.dest);
    osc1.start(t);
    osc1.stop(t + 0.17);

    // 2. Low-frequency thud / slice punch
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(160, t);
    osc2.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    gain2.gain.setValueAtTime(0.28, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc2.connect(gain2);
    gain2.connect(this.dest);
    osc2.start(t);
    osc2.stop(t + 0.15);
  }

  // Minecraft-Style Sweeping Edge Sword Slash / Airy Whoosh
  playSweepingEdge() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Sweeping wind noise whoosh
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.07));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, t);
      filter.frequency.exponentialRampToValueAtTime(320, t + 0.20);
      filter.Q.setValueAtTime(3.2, t);

      const gainNoise = this.ctx.createGain();
      gainNoise.gain.setValueAtTime(0.38, t);
      gainNoise.gain.exponentialRampToValueAtTime(0.01, t + 0.21);

      noise.connect(filter);
      filter.connect(gainNoise);
      gainNoise.connect(this.dest);
      noise.start(t);
    } catch (e) {}

    // 2. High-speed steel blade ring
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.17);
    oscGain.gain.setValueAtTime(0.22, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.17);

    osc.connect(oscGain);
    oscGain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Magic Fireball Cast
  playFireball() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(580, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Explosion / Impact
  playExplosion() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // Hit Impact
  playHit() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  // Level Up Fanfare
  playLevelUp() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime + (idx * 0.1);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.dest);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  // Gold Coin Chime
  playCoin() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [987.77, 1318.51]; // B5, E6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime + (idx * 0.08);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.dest);

      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  }

  // Potion Drink
  playPotion() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(520, this.ctx.currentTime + 0.12);
    osc.frequency.linearRampToValueAtTime(700, this.ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // Skill: Whirlwind / Dash
  playSkillWhoosh() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // Lock-on Target Chime
  playTargetLock() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1320, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // Blacksmith Anvil Hammer Clank
  playAnvil() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Metallic ping (High pitched ringing resonance)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1420, t);
    osc1.frequency.exponentialRampToValueAtTime(1100, t + 0.28);
    gain1.gain.setValueAtTime(0.28, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc1.connect(gain1);
    gain1.connect(this.dest);
    osc1.start(t);
    osc1.stop(t + 0.29);

    // Heavy iron thud (Low punch)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(180, t);
    osc2.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    gain2.gain.setValueAtTime(0.22, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc2.connect(gain2);
    gain2.connect(this.dest);
    osc2.start(t);
    osc2.stop(t + 0.16);
  }

  // Reforge / Enhancement Success Fanfare
  playUpgradeSuccess() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(this.dest);

      osc.start(noteTime);
      osc.stop(noteTime + 0.36);
    });
  }

  // Reforge / Enhancement Failed Dull Sound
  playUpgradeFail() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Steam / Fizzle descent
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.dest);

    osc.start(t);
    osc.stop(t + 0.31);
  }

  // Skill: Warrior Blade Charge (Sword Dash)
  playBladeCharge() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Heavy steel whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.28);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.29);

    // Sharp metallic blade slice
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1600, t + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(600, t + 0.24);
    gain2.gain.setValueAtTime(0.18, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.dest);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.26);
  }

  // Skill: Warrior Earthshaker Slam
  playEarthshaker() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Sub-bass seismic boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.36);

    // Low rumble
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(95, t);
    osc2.frequency.exponentialRampToValueAtTime(25, t + 0.42);
    gain2.gain.setValueAtTime(0.24, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc2.connect(gain2);
    gain2.connect(this.dest);
    osc2.start(t);
    osc2.stop(t + 0.43);
  }

  // Skill: Mage Arcane Blink (Teleport)
  playBlink() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Cosmic warp shimmer arpeggio
    [659.25, 987.77, 1318.51, 1975.53].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.035;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.16, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(st);
      osc.stop(st + 0.23);
    });
  }

  // Skill: Mage Frost Nova
  playFrostNova() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Glassy crystalline freeze
    [1174.66, 1479.98, 1760.00, 2349.32].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.025;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.18, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.32);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(st);
      osc.stop(st + 0.33);
    });
  }

  // Skill: Rogue Fan of Knives
  playFanOfKnives() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Rapid multiple blade whooshes
    [1200, 1500, 1800, 1350].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + i * 0.03;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(450, st + 0.12);
      gain.gain.setValueAtTime(0.16, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.13);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(st);
      osc.stop(st + 0.14);
    });
  }

  // Skill: Rogue Toxic Smoke Bomb
  playToxicBomb() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Glass shatter clink
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1850, t);
    osc1.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(this.dest);
    osc1.start(t);
    osc1.stop(t + 0.13);

    // Chemical sizzle / splash
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(420, t + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    gain2.gain.setValueAtTime(0.22, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.dest);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.36);
  }

  // Skill: Rogue Shadow Dash
  playShadowDash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Phantom swift whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.22);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  // Skill: Thunder / War Stomp / Lightning
  playThunder() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  // Skill: Shield / Barrier
  playShield() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.25);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Skill: Cosmic Singularity / Black Hole
  playSingularity() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.45);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.46);
  }

  // Skill: Berserk Rage
  playBerserk() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(260, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.38);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.39);
  }

  // Skill: Death Blossom Omnislash
  playBlossom() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450 + i * 80, t + delay);
      osc.frequency.exponentialRampToValueAtTime(120, t + delay + 0.08);
      gain.gain.setValueAtTime(0.18, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.08);
      osc.connect(gain);
      gain.connect(this.dest);
      osc.start(t + delay);
      osc.stop(t + delay + 0.09);
    }
  }

  // Skill: Venom Shurikens
  playShuriken() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.14);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

window.soundEngine = new SoundFX();
