import XCTest
import SwiftData
import RiptideCore
@testable import Riptide

@MainActor
final class SessionTests: XCTestCase {
    func testLoggingCreatesSessionAndTogglingCompletes() throws {
        let container = try ModelContainer.riptide(inMemory: true)
        let context = container.mainContext
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = [ExerciseBank.find("bench-press")!]
        let input = GeneratorInput(effort: .minimal, days: 2, selections: sel)
        let program = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "T", input: input, in: context)
        let day = program.sortedDays[0]
        let lift = day.sortedLifts[0]

        let logger = SetLogger(day: day, context: context)
        logger.toggle(lift: lift, setIndex: 0, weight: 135, reps: 8)
        let session = try XCTUnwrap(HistoryQueries.openSession(in: context))
        XCTAssertEqual(session.dayIndex, day.index)
        XCTAssertEqual(session.sets?.count, 1)

        // Toggling off removes the set.
        logger.toggle(lift: lift, setIndex: 0, weight: 135, reps: 8)
        XCTAssertEqual(HistoryQueries.openSession(in: context)?.sets?.count, 0)
    }

    /// Hardening: HistoryQueries.openSession(in:) is global, not day-scoped. SetLogger.session()
    /// must enforce the at-most-one-open-session invariant itself: starting a session for a new
    /// day must close any stragglers left open on other days, rather than assuming callers never
    /// leave one dangling.
    func testStartingNewDaySessionClosesStaleOpenSessionFromOtherDay() throws {
        let container = try ModelContainer.riptide(inMemory: true)
        let context = container.mainContext
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = [ExerciseBank.find("bench-press")!]
        let input = GeneratorInput(effort: .minimal, days: 2, selections: sel)
        let program = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "T", input: input, in: context)
        let day0 = program.sortedDays[0]
        let day1 = program.sortedDays[1]

        // Simulate a straggler: an open session for day 0 that was never finished.
        let stale = WorkoutSession(dayIndex: day0.index)
        stale.program = program
        context.insert(stale)
        XCTAssertNil(stale.finishedAt)

        // Logging a set for day 1 must create a new session and close the day-0 straggler,
        // leaving exactly one open session (day 1's).
        let lift1 = day1.sortedLifts[0]
        let logger = SetLogger(day: day1, context: context)
        logger.toggle(lift: lift1, setIndex: 0, weight: 95, reps: 10)

        let descriptor = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.finishedAt == nil })
        let openSessions = try context.fetch(descriptor)
        XCTAssertEqual(openSessions.count, 1)
        XCTAssertEqual(openSessions.first?.dayIndex, day1.index)
        XCTAssertNotNil(stale.finishedAt)
    }

    /// Finding 2: a prior session with sparse setIndices (0 and 2 logged, 1 skipped) must have
    /// its setIndex-2 data land on lookup key 2 — not on array position 1, which is what a
    /// positional `last[i]` mapping would do.
    func testLastSetsSparseSetIndexMapsByKeyNotPosition() throws {
        let container = try ModelContainer.riptide(inMemory: true)
        let context = container.mainContext
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = [ExerciseBank.find("bench-press")!]
        let input = GeneratorInput(effort: .minimal, days: 2, selections: sel)
        let program = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "T", input: input, in: context)
        let day = program.sortedDays[0]
        let lift = day.sortedLifts[0]

        let logger = SetLogger(day: day, context: context)
        logger.toggle(lift: lift, setIndex: 0, weight: 100, reps: 10)
        logger.toggle(lift: lift, setIndex: 2, weight: 140, reps: 6)

        let last = HistoryQueries.lastSets(exerciseID: lift.exerciseID, in: context)
        XCTAssertEqual(last.map(\.setIndex).sorted(), [0, 2])

        let bySetIndex = HistoryQueries.bySetIndex(last)
        XCTAssertEqual(bySetIndex[0]?.weight, 100)
        XCTAssertEqual(bySetIndex[2]?.weight, 140)
        XCTAssertNil(bySetIndex[1])
    }

    /// Must-fix 1: `HistoryQueries.lastSets(exerciseID:in:)` returns the MOST RECENT session's
    /// sets — if the current open session already has sets logged for this exercise, "most
    /// recent" is the current session, and prefill would show blanks for not-yet-logged sets
    /// instead of falling back to last time's numbers. Prefill must merge: current session's
    /// values win per setIndex, previous session's values fill the gaps.
    func testPrefillMergesCurrentSessionOverPreviousSessionBySetIndex() throws {
        let container = try ModelContainer.riptide(inMemory: true)
        let context = container.mainContext
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        sel[.chest] = [ExerciseBank.find("bench-press")!]
        let input = GeneratorInput(effort: .minimal, days: 2, selections: sel)
        let program = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "T", input: input, in: context)
        let day = program.sortedDays[0]
        let lift = day.sortedLifts[0]

        // A finished prior session: 3 sets at 135.
        let priorLogger = SetLogger(day: day, context: context)
        priorLogger.toggle(lift: lift, setIndex: 0, weight: 135, reps: 8)
        priorLogger.toggle(lift: lift, setIndex: 1, weight: 135, reps: 8)
        priorLogger.toggle(lift: lift, setIndex: 2, weight: 135, reps: 8)
        let priorSession = try XCTUnwrap(HistoryQueries.openSession(in: context))
        priorSession.finishedAt = Date()

        // A new, still-open session: only set 0 logged so far, at a different weight.
        let newLogger = SetLogger(day: day, context: context)
        newLogger.toggle(lift: lift, setIndex: 0, weight: 145, reps: 6)
        let newSession = try XCTUnwrap(HistoryQueries.openSession(in: context))
        XCTAssertNotEqual(newSession.persistentModelID, priorSession.persistentModelID)

        // Without exclusion, "most recent" would be the still-open new session — confirming
        // the bug this fix addresses.
        let naiveLast = HistoryQueries.lastSets(exerciseID: lift.exerciseID, in: context)
        XCTAssertEqual(naiveLast.map(\.setIndex), [0])

        let current = (newSession.sets ?? []).filter { $0.exerciseID == lift.exerciseID }
        let previous = HistoryQueries.lastSets(exerciseID: lift.exerciseID,
                                               excludingSession: newSession.persistentModelID, in: context)
        XCTAssertEqual(previous.map(\.setIndex).sorted(), [0, 1, 2])

        let merged = HistoryQueries.mergedBySetIndex(current: current, previous: previous)
        XCTAssertEqual(merged[0]?.weight, 145, "current session's logged set wins at index 0")
        XCTAssertEqual(merged[1]?.weight, 135, "falls back to previous session at index 1")
        XCTAssertEqual(merged[2]?.weight, 135, "falls back to previous session at index 2")
    }
}
