# Em~power — Change Log

Changes made autonomously from user feedback. Most recent first.

---

## 2026-06-08 — Feedback fix
**User said:** "There should be a place I can put period started"
**What was done:** Added a quiet "Period started today?" link at the top-right of the daily log card. Tapping it updates cycle_data with today as the period start date, immediately reveals the flow volume and pain fields, and updates the phase display to Menstrual Day 1. Hidden for Path 4 (perimenopause) users. Feedback marked resolved in Supabase.
**Files changed:** log.html, www/log.html

---

## 2026-06-08 — Path 4 full experience
**What was done:** Full perimenopause/menopause (Path 4) experience built out across all screens. Root fix in hormoneSync.js: Path 4 users now get phase "Perimenopause" from the start — no cycle calculations run regardless of database state. Perimenopause added to nutrition targets (1.8g/kg), intensity modifier (0.82), anomaly detection (fatigue and sleep patterns), PHASE_PREDICTIONS, and getMoodContextFeedback in algorithm_v3.js. Dashboard guards added for PCOS flag and endo flag (both incorrectly fired for Path 4 before). Science notes in checkin.html and log.html now adapt for Path 4 — cervical fluid framing changes from "fertile window" to estrogen signals. New Perimenopause phase card added to dashboard "Your hormonal phases" section.
**Files changed:** hormoneSync.js, algorithm_v3.js, dashboard.html, checkin.html, log.html, www/ mirrors

---
