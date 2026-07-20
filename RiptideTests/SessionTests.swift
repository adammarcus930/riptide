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
}
