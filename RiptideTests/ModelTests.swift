import XCTest
import SwiftData
import RiptideCore
@testable import Riptide

@MainActor
final class ModelTests: XCTestCase {
    private var container: ModelContainer!
    private var context: ModelContext { container.mainContext }

    override func setUp() async throws {
        container = try ModelContainer.riptide(inMemory: true)
    }

    private func makeInput() -> GeneratorInput {
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        for m in [MuscleGroup.chest, .lats, .triceps] {
            sel[m] = Array(ExerciseBank.exercises(for: m).prefix(2))
        }
        return GeneratorInput(effort: .optimal, days: 4, selections: sel)
    }

    func testMaterializeCreatesActiveProgramAndDeactivatesOthers() throws {
        let input = makeInput()
        let first = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "Block A", input: input, in: context)
        let second = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "Block B", input: input, in: context)
        XCTAssertFalse(first.isActive)
        XCTAssertTrue(second.isActive)
        XCTAssertEqual(second.sortedDays.count, 4)
        XCTAssertEqual(second.sortedDays.map(\.index), [0, 1, 2, 3])
        XCTAssertFalse(second.sortedDays[0].sortedLifts.isEmpty)
        XCTAssertEqual(second.effort, .optimal)
        XCTAssertEqual(Set(second.muscles), Set([.chest, .lats, .triceps]))
    }

    func testLastSetsCrossesPrograms() throws {
        let input = makeInput()
        let a = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "A", input: input, in: context)
        let session = WorkoutSession(dayIndex: 0)
        session.program = a
        context.insert(session)
        for (i, w) in [(0, 185.0), (1, 190.0)] {
            let s = LoggedSet(exerciseID: "bench-press", weight: w, reps: 8, setIndex: i)
            s.session = session
            context.insert(s)
        }
        session.finishedAt = Date()
        // New program; bench history must carry over.
        _ = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "B", input: input, in: context)
        let last = HistoryQueries.lastSets(exerciseID: "bench-press", in: context)
        XCTAssertEqual(last.map(\.weight), [185.0, 190.0])
        XCTAssertEqual(last.map(\.setIndex), [0, 1])
    }

    func testDeletingProgramKeepsLoggedHistory() throws {
        let input = makeInput()
        let a = ProgramMaterializer.materialize(ProgramGenerator.generate(input), named: "Block A", input: input, in: context)
        let session = WorkoutSession(dayIndex: 0, programName: a.name)
        session.program = a
        context.insert(session)
        let logged = LoggedSet(exerciseID: "bench-press", weight: 225, reps: 5, setIndex: 0)
        logged.session = session
        context.insert(logged)
        session.finishedAt = Date()

        // Delete the program the sets were logged under.
        context.delete(a)
        try context.save()

        // The program's plan is gone, but the workout and its per-exercise history survive.
        XCTAssertTrue((try context.fetch(FetchDescriptor<Program>())).isEmpty)
        let last = HistoryQueries.lastSets(exerciseID: "bench-press", in: context)
        XCTAssertEqual(last.map(\.weight), [225])
        let survivors = try context.fetch(FetchDescriptor<WorkoutSession>())
        XCTAssertEqual(survivors.count, 1)
        XCTAssertNil(survivors[0].program)          // nullified, not cascaded
        XCTAssertEqual(survivors[0].programName, "Block A") // still labeled for History
    }

    func testOpenSessionFindsOnlyUnfinished() throws {
        XCTAssertNil(HistoryQueries.openSession(in: context))
        let s = WorkoutSession(dayIndex: 1)
        context.insert(s)
        XCTAssertNotNil(HistoryQueries.openSession(in: context))
        s.finishedAt = Date()
        XCTAssertNil(HistoryQueries.openSession(in: context))
    }
}
