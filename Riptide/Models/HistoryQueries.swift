import Foundation
import SwiftData

enum HistoryQueries {
    /// Latest session's sets for an exercise — any program (spec §4:
    /// history is exercise-scoped). Sorted by setIndex.
    static func lastSets(exerciseID: String, in context: ModelContext) -> [LoggedSet] {
        var descriptor = FetchDescriptor<LoggedSet>(
            predicate: #Predicate { $0.exerciseID == exerciseID },
            sortBy: [SortDescriptor(\.completedAt, order: .reverse)]
        )
        descriptor.fetchLimit = 50
        guard let recent = try? context.fetch(descriptor), let newest = recent.first,
              let sessionID = newest.session?.persistentModelID else { return [] }
        return recent
            .filter { $0.session?.persistentModelID == sessionID }
            .sorted { $0.setIndex < $1.setIndex }
    }

    static func openSession(in context: ModelContext) -> WorkoutSession? {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.finishedAt == nil },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor))?.first
    }
}

/// Set toggling shared by LiftDetailView and tests: creates the session lazily,
/// removes on un-toggle.
@MainActor
struct SetLogger {
    let day: ProgramDay
    let context: ModelContext

    private func session() -> WorkoutSession {
        if let open = HistoryQueries.openSession(in: context), open.dayIndex == day.index { return open }
        // Enforce at-most-one-open-session: close any stragglers from other days.
        // openSession(in:) is global (most-recent unfinished session, any day), so callers
        // starting a session for a new day must not just assume the invariant holds.
        let stale = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.finishedAt == nil })
        for s in (try? context.fetch(stale)) ?? [] { s.finishedAt = Date() }
        let s = WorkoutSession(dayIndex: day.index)
        s.program = day.program
        context.insert(s)
        return s
    }

    func logged(lift: PlannedLift, setIndex: Int) -> LoggedSet? {
        guard let open = HistoryQueries.openSession(in: context), open.dayIndex == day.index else { return nil }
        return (open.sets ?? []).first { $0.exerciseID == lift.exerciseID && $0.setIndex == setIndex }
    }

    func toggle(lift: PlannedLift, setIndex: Int, weight: Double, reps: Int) {
        if let existing = logged(lift: lift, setIndex: setIndex) {
            context.delete(existing)
            try? context.save()
        } else {
            let s = LoggedSet(exerciseID: lift.exerciseID, weight: weight, reps: reps, setIndex: setIndex)
            s.session = session()
            context.insert(s)
        }
    }
}
