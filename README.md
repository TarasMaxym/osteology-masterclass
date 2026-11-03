# JUMC Osteology & Pins Masterclass — Test 1 Practical Prep

Interactive, high-yield mastery platform for the **Jagiellonian University Medical College (JUMC)** Anatomy Test 1 Practical Exam (Labs 1–9 Osteology & Arthrology).

🌐 **Live Web App:** [https://tarasmaxym.github.io/osteology-masterclass/](https://tarasmaxym.github.io/osteology-masterclass/)  
💻 **Local App:** Double-click `Launch Osteology Masterclass.command` or run `python3 server.py --port 8765`

---

## 7 Integrated Study Modes

1. **Pin Grinder (30s Timed Active Recall):** Official teacher pin decks with smart fuzzy grading, anatomical synonyms, instant feedback, and directional spot cues.
2. **Drop the Pin (Reverse Recognition):** Click directly on unlabeled bone and skull photographs to locate landmarks.
3. **Speed Blitz:** Rapid-fire keyboard recognition drill to build instant pattern matching.
4. **20-Pin Mock Exam:** Strict simulation of the official 20-specimen practical test (30s per pin, no repeats, detailed diagnostic scorecard aiming for 18+/20 exemption target).
5. **Tendons & Gaps:** High-yield drills on muscle insertions, tendon grooves, foramina neurovascular contents, and visual occlusion cards.
6. **Specimen Atlas & Radar:** Interactive 103-slide specimen explorer with live weak-spot clustering and diagnostic heatmaps.
7. **Bone & Side ID:** Rapid identification of isolated bone specimens, left vs. right specimens with 3-point anatomical orientation guides, and discrimination showdowns (cervical/thoracic/lumbar/atypical vertebrae, carpals, tarsals).

---

## Repository Structure

- `index.html` — Main responsive single-page web application
- `styles.css` — High-contrast dark medical-grade UI styling
- `app.js` — Client engine, grading algorithms, SVG pin projection, local persistence
- `data/dataset.json` — 407 official pins, 103 slides, gap drills, and bone ID banks
- `media/` — Optimized specimen photos and arrows
- `server.py` — Zero-dependency Python 3 local server with atomic progress persistence
- `build_dataset.py` — PPTX/DOCX extractor and dataset builder
- `bone_id_kb.py` — Knowledge base for Bone ID and 3-point anatomical siding rules
- `publish.sh` — One-click rebuild, commit, and push to GitHub Pages
