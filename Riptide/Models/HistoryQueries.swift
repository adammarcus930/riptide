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

    /// Latest session's sets for an exercise, excluding a specific session — used to find the
    /// *previous* session's numbers when a session is already open and may already contain sets
    /// for this exercise (see `lastSets(exerciseID:in:)` doc: without exclusion, "most recent"
    /// would just be the still-open current session).
    static func lastSets(exerciseID: String, excludingSession sessionID: PersistentIdentifier,
                         in context: ModelContext) -> [LoggedSet] {
        var descriptor = FetchDescriptor<LoggedSet>(
            predicate: #Predicate { $0.exerciseID == exerciseID },
            sortBy: [SortDescriptor(\.completedAt, order: .reverse)]
        )
        descriptor.fetchLimit = 50
        guard let recent = try? context.fetch(descriptor),
              let newest = recent.first(where: { $0.session?.persistentModelID != sessionID }),
              let newestSessionID = newest.session?.persistentModelID else { return [] }
        return recent
            .filter { $0.session?.persistentModelID == newestSessionID }
            .sorted { $0.setIndex < $1.setIndex }
    }

    static func openSession(in context: ModelContext) -> WorkoutSession? {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.finishedAt == nil },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor))?.first
    }

    /// Maps a set list (as returned by `lastSets`) to a setIndex → set lookup, so callers can
    /// prefill by logical set position rather than array position — a prior session with sparse
    /// setIndices (e.g. only 0 and 2 logged) must not have `last[1]` silently land on row 1.
    /// Uses the last value on a duplicate key defensively, though `lastSets` is already
    /// single-session so setIndex values are unique in practice.
    static func bySetIndex(_ sets: [LoggedSet]) -> [Int: LoggedSet] {
        Dictionary(sets.map { ($0.setIndex, $0) }, uniquingKeysWith: { _, last in last })
    }

    /// Merges the current (open) session's sets over the previous session's, keyed by setIndex —
    /// so a lift re-entered mid-workout shows what was *already logged this session* for indices
    /// the user has hit, and falls back to last time's numbers for indices not yet logged.
    /// Current-session values win per index; previous-session values fill the gaps.
    static func mergedBySetIndex(current: [LoggedSet], previous: [LoggedSet]) -> [Int: LoggedSet] {
        var merged = bySetIndex(previous)
        for (index, set) in bySetIndex(current) { merged[index] = set }
        return merged
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
        let s = WorkoutSession(dayIndex: day.index, programName: day.program?.name ?? "")
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
            try? context.save()
        }
    }
}
