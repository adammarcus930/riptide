import SwiftUI
import SwiftData
import RiptideCore

struct DayDetailView: View {
    @Environment(\.modelContext) private var context
    @Bindable var day: ProgramDay
    @State private var editing = false
    @State private var showAdd = false

    private var loggedIDs: Set<String> {
        guard let session = HistoryQueries.openSession(in: context), session.dayIndex == day.index else { return [] }
        return Set((session.sets ?? []).map(\.exerciseID))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("DAY \(day.index + 1)").eyebrow(Theme.accent)
                Text(day.focus).font(.system(size: 30, weight: .heavy))
                let total = day.sortedLifts.reduce(0) { $0 + $1.targetSets }
                Text("\(day.sortedLifts.count) lifts · \(total) sets")
                    .font(.system(size: 13)).foregroundStyle(Theme.textDim)

                ForEach(day.sortedLifts, id: \.persistentModelID) { lift in
                    if editing { planRow(lift) } else { liveRow(lift) }
                }

                if editing {
                    Button {
                        showAdd = true
                    } label: {
                        Text("+ Add a lift")
                            .font(.system(size: 14, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .overlay(RoundedRectangle(cornerRadius: 14)
                                .stroke(Theme.strokeDashed, style: StrokeStyle(lineWidth: 1, dash: [5])))
                    }
                    .foregroundStyle(Theme.text.opacity(0.75))
                } else {
                    Button(day.completedInCycle ? "Day logged" : "Complete day") { completeDay() }
                        .buttonStyle(AccentButtonStyle())
                        .disabled(day.completedInCycle)
                        .opacity(day.completedInCycle ? 0.5 : 1)
                        .padding(.top, 8)
                }
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(editing ? "Done" : "Edit") { editing.toggle() }
                    .foregroundStyle(Theme.accent)
            }
        }
        .sheet(isPresented: $showAdd) { AddLiftView(day: day) }
        .navigationDestination(for: LiftRef.self) { ref in
            if let lift = context.model(for: ref.id) as? PlannedLift {
                LiftDetailView(lift: lift, day: day)
            }
        }
    }

    private func liveRow(_ lift: PlannedLift) -> some View {
        NavigationLink(value: LiftRef(id: lift.persistentModelID)) {
            HStack(spacing: 13) {
                let done = loggedIDs.contains(lift.exerciseID)
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(done ? Theme.accent : Theme.textFaint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(lift.exerciseName).font(.system(size: 15, weight: .bold))
                    Text("\(lift.targetSets) sets · \(lift.repRange) reps")
                        .font(.system(size: 12)).foregroundStyle(Theme.textFaint)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.text.opacity(0.3))
            }
            .card()
        }
        .buttonStyle(.plain)
    }

    private func planRow(_ lift: PlannedLift) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(lift.exerciseName).font(.system(size: 15, weight: .bold))
                    Text("\(lift.repRange) reps · \(MuscleGroup(rawValue: lift.muscleRaw)?.label ?? "")")
                        .font(.system(size: 12)).foregroundStyle(Theme.textFaint)
                }
                Spacer()
            }
            HStack(spacing: 8) {
                HStack(spacing: 0) {
                    Button { lift.targetSets = max(1, lift.targetSets - 1) } label: {
                        Image(systemName: "minus").frame(width: 32, height: 32)
                    }
                    Text("\(lift.targetSets) sets")
                        .font(.system(size: 12, weight: .heavy))
                        .frame(minWidth: 52)
                    Button { lift.targetSets = min(10, lift.targetSets + 1) } label: {
                        Image(systemName: "plus").frame(width: 32, height: 32)
                    }
                }
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.strokeStrong))
                Spacer()
                Menu {
                    let muscle = MuscleGroup(rawValue: lift.muscleRaw)
                    ForEach(ExerciseBank.exercises(for: muscle ?? .chest).filter { $0.id != lift.exerciseID }) { alt in
                        Button(alt.name) { swap(lift, to: alt) }
                    }
                } label: {
                    Label("Swap", systemImage: "arrow.left.arrow.right")
                        .font(.system(size: 12, weight: .heavy))
                        .padding(.horizontal, 13).frame(height: 32)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.strokeStrong))
                        .foregroundStyle(Theme.accent)
                }
                Button {
                    context.delete(lift)
                } label: {
                    Image(systemName: "xmark").frame(width: 32, height: 32)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.strokeStrong))
                        .foregroundStyle(Theme.textDim)
                }
            }
        }
        .card()
    }

    private func swap(_ lift: PlannedLift, to ex: ExerciseDefinition) {
        lift.exerciseID = ex.id
        lift.exerciseName = ex.name
        lift.muscleRaw = ex.primary.rawValue
        lift.repRange = ex.repRange
    }

    private func completeDay() {
        day.completedInCycle = true
        if let session = HistoryQueries.openSession(in: context), session.dayIndex == day.index {
            session.finishedAt = Date()
        }
        Haptics.success()
    }
}

// TEMPORARY stubs — Task 12 replaces both with the real lift detail screen and haptics helper.
struct LiftDetailView: View {
    let lift: PlannedLift
    let day: ProgramDay
    var body: some View { Text(lift.exerciseName).foregroundStyle(Theme.text) }
}

enum Haptics {
    static func success() {}
}
