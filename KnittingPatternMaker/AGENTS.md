# Project: KnittingPro - Knitting Pattern Maker App

## Status (Jul 2026)
- Scroll fixed on all screens (changed `overflow: visible` → `overflow: auto`, ScrollWrapper uses `minHeight`)
- PDF download works via anchor click on web
- Toy/Plush pattern type added (animals, dolls, cartoons)
- Backend Flask API runs at `http://localhost:5000`
- Expo web server at `http://localhost:8081`

## Architecture
- React Native (Expo SDK 56) + React 19
- Web testing via `npx expo start --web`
- Backend: Python Flask on port 5000
- PDF: ReportLab in `pdf_generator.py`

## Pattern Types
| Type | Screen | Endpoint | PDF Pages |
|------|--------|----------|-----------|
| Image → Chart | HomeScreen | `/api/convert` | 4 |
| Sweater | EditScreen | `/api/sweater-pattern` | 8 |
| Stitch Blanket | StitchBlanketScreen | `/api/stitch-blanket` | 3+ |
| Toy/Plush | ToyScreen | `/api/toy-pattern` | 6 |

## PDF Improvements
- Sweater: Professional schematic with lettered measurements (A-F), 8 pages
- Toy: Cover with diagram, chart, back panel, materials, assembly (6 pages)
- All include: step-by-step instructions, abbreviations, gauge info

## Key Files
- `Backend/pdf_generator.py` — all PDF layout (sweater, toy, stitches)
- `Backend/sweater_pattern.py` — sweater panel generation
- `Backend/app.py` — Flask routes
- `Backend/pattern_maker.py` — image → chart conversion
- `src/services/ApiService.js` — API calls
- `src/screens/ToyScreen.js` — Toy pattern config
- `src/components/ScrollWrapper.js` — web-safe scroll

## Future: AI YouTube Feature
Planned architecture:
1. Image analysis → keyword generation → YouTube Data API search
2. yt-dlp download → OpenCV frame extraction → Whisper transcription
3. Match frames to instructions → Generate enhanced PDF guide
Requires: Google API key, yt-dlp, openai-whisper
