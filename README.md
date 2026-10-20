# ⚔️ Slop Hero - Isometric Web MMORPG

A real-time multiplayer isometric action RPG built with Node.js, Express, Socket.IO, and HTML5 Canvas.

## ✨ Features

- **🎮 Real-time Multiplayer**: Authoritative server with Socket.IO syncing players, monsters, combat, and loot.
- **🗺️ Procedural Dungeons & Town**: Peaceful town hub with shops, reforging blacksmith, and infinite multi-floor procedural dungeons.
- **🧙 Classes & Skills System**:
  - **Warrior (นักรบ / สายดาบ)**:
    - `[Q]` **Whirlwind Slash**: 360° AoE physical spin attack.
    - `[E]` **Earthshaker Slam**: Ground slam creating fissures, heavy damage & slow/stagger.
    - `[Shift]` **Blade Charge Dash**: Plunges forward with sword slicing through enemies with knockback.
  - **Mage (จอมเวท / สายเวท)**:
    - `[Q]` **Firestorm Meteor**: Massive meteor explosion with Burn damage-over-time.
    - `[E]` **Frost Nova**: Expanding freezing blizzard ring with 50% Chill slow.
    - `[Shift]` **Arcane Blink**: Instant dimensional teleport break crowd-control with arcane burst.
  - **Rogue (นักฆ่า / โจร)**:
    - `[Q]` **Fan of Knives**: Whirling flurry of razor daggers with lethal crit bonus.
    - `[E]` **Toxic Smoke Bomb**: Chemical poison mist cloud applying Poison damage-over-time.
    - `[Shift]` **Shadow Dash**: Blazing swift phantom dash with sprint speed boost.
- **🗡️ 8-Directional Humanoid Character Rig**: Smooth pendulum walking animations, front/back perspectives, dynamic gear & capes.
- **💎 Equipment & Reforging**: Equipment stat scaling, weapon upgrades, armor bonuses.
- **👾 Smart Monster AI & Affixes**: Commander auras, elite affixes (Fortified, Frostbite, Venomous, Ignited).
- **📦 Auto-Loot & Inventory System**: Seamless item pickups, equipment slots, potion quick-slots.
- **🔊 Procedural Web Audio**: Built-in sound effects via Web Audio API without external asset dependencies.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/nuttaponkhamkul123/slop-hero.git
   cd slop-hero
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm run start
   ```

4. Open `http://localhost:3000` in your browser.

## 🕹️ Controls

- **W / A / S / D** or **Click-to-Move**: Move character (8 directions)
- **Spacebar**: Basic attack (hits targeted or nearest enemy)
- **Q**: Class Skill 1 (Primary AoE)
- **E**: Class Skill 2 (Crowd Control / Tactical)
- **Shift**: Class Dash / Teleport (Mobility)
- **1**: Health potion
- **2**: Mana potion
- **Tab**: Cycle nearest monster targets
- **I**: Toggle Inventory
- **C**: Toggle Character Stats
- **R**: Open Reforge / Blacksmith
- **P**: Open Merchant Shop
- **H**: Help dialog
- **Enter**: Chat box

## 📜 License

ISC
