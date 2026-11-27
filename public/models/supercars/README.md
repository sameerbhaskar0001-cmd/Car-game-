# Drop-In Supercars Directory (`/public/models/supercars/`)

Drop your Phase 2 Sketchfab CC-BY / CC0 high-poly supercars here (`.glb`, Draco or standard glTF Binary).

## Recommended Rules for 60 FPS Mobile + Web
- **Triangles:** `40,000 – 120,000` triangles per car (sweet spot: ~60K–90K, e.g. *V12 Goblin* 86K).
- **License:** `CC-BY` or `CC0` fictional supercars for commercial / Play Store builds.
- **Note:** `ferrari.glb` is included for Phase 1 engine visual benchmarking (Three.js official demo asset); swap/remove before commercial Play Store publication.

## Adding a New Car
1. Drop `your_car.glb` into `/public/models/supercars/`.
2. Register its entry in `SUPERCAR_CATALOG` inside `/src/scene/SupercarLoader.js` and `BODY_KITS` in `/src/types/game.ts`.
