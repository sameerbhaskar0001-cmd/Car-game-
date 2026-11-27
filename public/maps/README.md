# Drop-In Pure 3D Maps Directory (`/public/maps/`)

Drop Phase 3 pure-3D `.glb` tracks and their recorded centerline spline JSON files here.

## Folder Structure per Map
```text
public/maps/<map_id>/
  ├── track.glb      (50K – 350K triangles, Draco recommended)
  └── spline.json    (Centerline racing path + road half-widths)
```

## Scaling to 30–50 Tracks
Reuse 6–8 pure 3D world `.glb` biomes across multiple `spline.json` routes, reverse layouts, time-of-day HDRIs, and weather presets!
