# ⚔️ Slop Hero - Isometric Web MMORPG

A real-time multiplayer isometric action RPG built with Node.js, Express, Socket.IO, and HTML5 Canvas.

## ✨ Features

- **🎮 Real-time Multiplayer**: Authoritative server with Socket.IO syncing players, monsters, combat, and loot.
- **🗺️ Procedural Dungeons & Town**: Peaceful town hub with shops, reforging blacksmith, and infinite multi-floor procedural dungeons.
- **🧙 Classes & Skills**:
  - **Warrior**: Whirlwind Slash (AoE)
  - **Mage**: Firestorm Meteor
  - **Rogue**: Shadow Strike Dash
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
- **Q**: Class ability / special skill
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
