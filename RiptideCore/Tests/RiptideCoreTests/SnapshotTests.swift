import XCTest
@testable import RiptideCore

final class SnapshotTests: XCTestCase {
    private var snapshotDir: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Snapshots")
    }

    /// Compare against committed snapshot; record it on first run (then fail, prompting review).
    private func assertSnapshot(_ value: String, named name: String,
                                file: StaticString = #filePath, line: UInt = #line) throws {
        let url = snapshotDir.appendingPathComponent("\(name).txt")
        if !FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.createDirectory(at: snapshotDir, withIntermediateDirectories: true)
            try value.write(to: url, atomically: true, encoding: .utf8)
            XCTFail("Recorded new snapshot \(name).txt — review it, commit it, re-run.", file: file, line: line)
            return
        }
        let expected = try String(contentsOf: url, encoding: .utf8)
        XCTAssertEqual(value, expected, "Snapshot \(name) drifted. If intentional, delete the file and re-record.",
                       file: file, line: line)
    }

    private func input(effort: Effort, days: Int, perMuscle: Int) -> GeneratorInput {
        var sel: [MuscleGroup: [ExerciseDefinition]] = [:]
        for m in MuscleGroup.allCases { sel[m] = Array(ExerciseBank.exercises(for: m).prefix(perMuscle)) }
        return GeneratorInput(effort: effort, days: days, selections: sel)
    }

    func testOptimalFourDayTwoExercises() throws {
        try assertSnapshot(ProgramPrinter.table(ProgramGenerator.generate(input(effort: .optimal, days: 4, perMuscle: 2))),
                           named: "optimal-4day-2ex")
    }

    func testMinimalTwoDayTwoExercises() throws {
        try assertSnapshot(ProgramPrinter.table(ProgramGenerator.generate(input(effort: .minimal, days: 2, perMuscle: 2))),
                           named: "minimal-2day-2ex")
    }

    func testMaximalSevenDayThreeExercises() throws {
        try assertSnapshot(ProgramPrinter.table(ProgramGenerator.generate(input(effort: .maximal, days: 7, perMuscle: 3))),
                           named: "maximal-7day-3ex")
    }
}
