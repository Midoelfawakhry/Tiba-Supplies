# Phase 1 Ras Sedr Office Coordinates

Canonical Ras Sedr branch coordinates supplied by the project owner on 2026-10-14:
- Latitude: 29.556864
- Longitude: 32.761699
- Geofence radius: 10,000 metres (initial project rule)

These coordinates are reference configuration for the Ras Sedr BRANCH office. Keep MAIN / HEAD_OFFICE separate. Do not treat these coordinates as the Main Office location.

Geofence implementation must fail closed when the coordinates or fresh driver location are missing. Location eligibility must use the centrally configured radius and freshness policy; do not duplicate magic numbers across UI and server logic.

This is a configuration reference only. It does not seed driver, vehicle, user, booking, or load data.
