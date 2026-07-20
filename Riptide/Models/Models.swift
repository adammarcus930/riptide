import Foundation
import SwiftData
import RiptideCore

extension MuscleGroup {
    /// Decodes a persisted raw value, mapping the pre-2026-07-20 `shoulders`
    /// group onto side delts (its dominant component).
    static func decode(_ raw: String) -> MuscleGroup? {
        if let m = MuscleGroup(rawValue: raw) { return m }
        return raw == "shoulders" ? .sideDelts : nil
    }
}

@Model
final class Program {
    var name: String = ""
    var effortRaw: String = Effort.optimal.rawValue
    var daysPerWeek: Int = 4
    var musclesJoined: String = ""          // comma-joined MuscleGroup raw values (CloudKit-safe)
    var createdAt: Date = Date()
    var isActive: Bool = false
    @Relationship(deleteRule: .cascade, inverse: \ProgramDay.program)
    var days: [ProgramDay]? = []
    @Relationship(deleteRule: .cascade, inverse: \WorkoutSession.program)
    var sessions: [WorkoutSession]? = []

    init(name: String = "", effort: Effort = .optimal, daysPerWeek: Int = 4, muscles: [MuscleGroup] = []) {
        self.name = name
        self.effortRaw = effort.rawValue
        self.daysPerWeek = daysPerWeek
        self.musclesJoined = muscles.map(\.rawValue).joined(separator: ",")
    }

    var effort: Effort { Effort(rawValue: effortRaw) ?? .optimal }
    var muscles: [MuscleGroup] { musclesJoined.split(separator: ",").compactMap { MuscleGroup.decode(String($0)) } }
    var sortedDays: [ProgramDay] { (days ?? []).sorted { $0.index < $1.index } }
    var completedDayCount: Int { (days ?? []).filter(\.completedInCycle).count }
}

@Model
final class ProgramDay {
    var index: Int = 0
    var completedInCycle: Bool = false
    var program: Program?
    @Relationship(deleteRule: .cascade, inverse: \PlannedLift.day)
    var lifts: [PlannedLift]? = []

    init(index: Int = 0) { self.index = index }

    var sortedLifts: [PlannedLift] { (lifts ?? []).sorted { $0.order < $1.order } }
    /// "Chest · Lats · Triceps" style focus line for cards.
    var focus: String {
        let muscles = sortedLifts.compactMap { MuscleGroup.decode($0.muscleRaw) }
        var seen: [MuscleGroup] = []
        for m in muscles where !seen.contains(m) { seen.append(m) }
        return seen.prefix(3).map(\.label).joined(separator: " · ") + (seen.count > 3 ? " +" : "")
    }
}

@Model
final class PlannedLift {
    var order: Int = 0
    var exerciseID: String = ""
    var exerciseName: String = ""
    var muscleRaw: String = ""
    var targetSets: Int = 3
    var repRange: String = ""
    var day: ProgramDay?

    init(order: Int = 0, exercise: ExerciseDefinition? = nil, targetSets: Int = 3) {
        self.order = order
        if let ex = exercise {
            self.exerciseID = ex.id
            self.exerciseName = ex.name
            self.muscleRaw = ex.primary.rawValue
            self.repRange = ex.repRange
        }
        self.targetSets = targetSets
    }
}

@Model
final class WorkoutSession {
    var startedAt: Date = Date()
    var finishedAt: Date? = nil
    var dayIndex: Int = 0
    var program: Program?
    @Relationship(deleteRule: .cascade, inverse: \LoggedSet.session)
    var sets: [LoggedSet]? = []

    init(dayIndex: Int = 0) { self.dayIndex = dayIndex }
}

@Model
final class LoggedSet {
    var exerciseID: String = ""
    var weight: Double = 0
    var reps: Int = 0
    var setIndex: Int = 0
    var completedAt: Date = Date()
    var session: WorkoutSession?

    init(exerciseID: String = "", weight: Double = 0, reps: Int = 0, setIndex: Int = 0) {
        self.exerciseID = exerciseID
        self.weight = weight
        self.reps = reps
        self.setIndex = setIndex
    }
}

extension ModelContainer {
    static func riptide(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([Program.self, ProgramDay.self, PlannedLift.self, WorkoutSession.self, LoggedSet.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        return try ModelContainer(for: schema, configurations: [config])
    }
}
