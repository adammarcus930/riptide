# Riptide manual QA checklist

Automated tests (RiptideCore `swift test` and the Riptide `xcodebuild test`
suite) cover generation logic, models, and view-model-level behavior, but the
items below require a human driving a real device or the iOS Simulator —
they were not verified by this change and should be walked before shipping.

- [ ] 1. Fresh install → empty Today → wizard (each effort gates days correctly) → program generated.
- [ ] 2. Generated week sanity: full-body days, 2–4 set entries, exercises rotate across days.
- [ ] 3. Start day → log all sets on a lift → timer runs → complete lift → complete day → dot flips DONE.
- [ ] 4. All days → Week complete → Start next cycle resets dots, plan intact.
- [ ] 5. Edit day: stepper/swap/remove/add all persist across relaunch.
- [ ] 6. Second program via Library → bench prefill carries from program A. Make-active switching works both ways.
- [ ] 7. Mid-session: kill app → relaunch → resume banner present; screen stays awake during session.
- [ ] 8. Shoulders now split into front/side/rear delts in the wizard; side delts (maximal effort, 5 days, one exercise) sits at the tightest capacity boundary in the table — confirm it fills to the low end without an erroneous shortfall note.
- [ ] 9. History lists finished sessions; rest-alert setting changes timer accent threshold.
