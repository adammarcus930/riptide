import SwiftUI
import SwiftData
import RiptideCore

struct LiftDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let lift: PlannedLift
    let day: ProgramDay

    // Observed so the DONE checkmarks refresh the instant a set is logged/cleared.
    @Query(filter: #Predicate<WorkoutSession> { $0.finishedAt == nil }) private var openSessions: [WorkoutSession]
    @AppStorage("restAlertSec") private var restAlertSec = 180
    @State private var timer = RestTimer()
    @State private var weights: [String] = []
    @State private var reps: [String] = []
    @State private var appeared = false
    @FocusState private var fieldFocused: Bool

    private var exercise: ExerciseDefinition? { ExerciseBank.find(lift.exerciseID) }
    private var logger: SetLogger { SetLogger(day: day, context: context) }

    /// Set indices already logged for this lift in the open session (observed via @Query).
    private var loggedSetIndices: Set<Int> {
        guard let session = openSessions.first(where: { $0.dayIndex == day.index }) else { return [] }
        return Set((session.sets ?? []).filter { $0.exerciseID == lift.exerciseID }.map(\.setIndex))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Theme.strokeDashed, style: StrokeStyle(lineWidth: 1, dash: [6]))
                    .frame(height: 130)
                    .overlay(Text("exercise demo · coming later")
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.textFaint))

                HStack(spacing: 8) {
                    Text((MuscleGroup.decode(lift.muscleRaw)?.label ?? "").uppercased())
                        .font(.system(size: 11, weight: .heavy)).kerning(0.8)
                        .padding(.horizontal, 11).padding(.vertical, 5)
                        .background(Theme.accent.opacity(0.12), in: Capsule())
                        .foregroundStyle(Theme.accent)
                    if let secs = exercise?.secondaries, !secs.isEmpty {
                        Text("also hits \(secs.map(\.label).joined(separator: ", "))")
                            .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                    }
                }
                Text(lift.exerciseName).font(.system(size: 28, weight: .heavy))
                if let blurb = exercise?.blurb {
                    Text(blurb).font(.system(size: 13)).foregroundStyle(Theme.textDim).lineSpacing(3)
                }

                // SET / WEIGHT / REPS / DONE grid
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow {
                        Text("SET").eyebrow().gridColumnAlignment(.leading)
                        Text("WEIGHT · LB").eyebrow()
                        Text("REPS").eyebrow()
                        Text("DONE").eyebrow()
                    }
                    ForEach(0..<lift.targetSets, id: \.self) { i in
                        GridRow {
                            Text("\(i + 1)").font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.textDim)
                            setField($weights, i, placeholder: "0")
                            setField($reps, i, placeholder: lift.repRange)
                            let done = loggedSetIndices.contains(i)
                            Button {
                                toggleSet(i)
                            } label: {
                                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 26))
                                    .foregroundStyle(done ? Theme.accent : Theme.textFaint)
                            }
                        }
                    }
                }
                .padding(.top, 8)

                // Rest timer card
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("REST TIMER").eyebrow()
                        Text(timer.isRunning ? timer.display : "—")
                            .font(.system(size: 26, weight: .bold, design: .monospaced))
                            .foregroundStyle(timer.elapsed >= Double(restAlertSec) ? Theme.accent : Theme.text)
                    }
                    Spacer()
                    if timer.isRunning {
                        Button("Stop") { timer.stop(); Notifications.cancelRestAlert() }
                            .font(.system(size: 13, weight: .bold))
                            .padding(.horizontal, 14).padding(.vertical, 11)
                            .background(Theme.stroke, in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                .card()

                Button("Complete lift") { dismiss() }
                    .buttonStyle(AccentButtonStyle())
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { fieldFocused = false }
            }
        }
        .onAppear {
            guard !appeared else { return }
            appeared = true
            prefill()
        }
        .onDisappear { timer.stop(); Notifications.cancelRestAlert() }
    }

    /// Prefill from last session on this exercise — any program (spec §4/§7). Merges in
    /// whatever's already logged for this exercise in the *current* open session (if any) so
    /// re-entering a lift mid-workout shows what was actually done for logged sets, falling back
    /// to the previous session's numbers for sets not yet logged this session.
    private func prefill() {
        let openSession = HistoryQueries.openSession(in: context)
        let current: [LoggedSet]
        if let openSession, openSession.dayIndex == day.index {
            current = (openSession.sets ?? []).filter { $0.exerciseID == lift.exerciseID }
        } else {
            current = []
        }
        let previous: [LoggedSet]
        if let openSession {
            previous = HistoryQueries.lastSets(exerciseID: lift.exerciseID,
                                               excludingSession: openSession.persistentModelID, in: context)
        } else {
            previous = HistoryQueries.lastSets(exerciseID: lift.exerciseID, in: context)
        }
        let merged = HistoryQueries.mergedBySetIndex(current: current, previous: previous)
        weights = (0..<lift.targetSets).map { i in
            guard let set = merged[i] else { return "" }
            let w = set.weight
            return w == w.rounded() ? String(Int(w)) : String(w)
        }
        reps = (0..<lift.targetSets).map { i in merged[i].map { String($0.reps) } ?? "" }
    }

    private func setField(_ values: Binding<[String]>, _ i: Int, placeholder: String) -> some View {
        TextField(placeholder, text: Binding(
            get: { i < values.wrappedValue.count ? values.wrappedValue[i] : "" },
            set: { v in
                var arr = values.wrappedValue
                while arr.count <= i { arr.append("") }
                arr[i] = v
                values.wrappedValue = arr
            }
        ))
        .keyboardType(.decimalPad)
        .focused($fieldFocused)
        .multilineTextAlignment(.center)
        .font(.system(size: 15, weight: .bold))
        .padding(.vertical, 11)
        .background(Theme.inputBg, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.stroke))
    }

    private func toggleSet(_ i: Int) {
        let w = Double(i < weights.count ? weights[i] : "") ?? 0
        let r = Int(i < reps.count ? reps[i] : "") ?? 0
        logger.toggle(lift: lift, setIndex: i, weight: w, reps: r)
        Haptics.tap()
        if logger.logged(lift: lift, setIndex: i) != nil {
            timer.start()
            Notifications.requestAuthOnce()
            Notifications.scheduleRestAlert(after: restAlertSec)
        } else {
            timer.stop()
            Notifications.cancelRestAlert()
        }
    }
}
