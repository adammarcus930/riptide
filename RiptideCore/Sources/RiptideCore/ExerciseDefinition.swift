import Foundation

public struct ExerciseDefinition: Codable, Identifiable, Equatable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let primary: MuscleGroup
    public let secondaries: [MuscleGroup]
    public let repRange: String
    public let blurb: String
}

public enum ExerciseBank {
    public static let all: [ExerciseDefinition] = {
        guard let url = Bundle.module.url(forResource: "exercises", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([ExerciseDefinition].self, from: data)
        else { fatalError("exercises.json missing or malformed") }
        return list
    }()

    public static func exercises(for muscle: MuscleGroup) -> [ExerciseDefinition] {
        all.filter { $0.primary == muscle }
    }

    public static func find(_ id: String) -> ExerciseDefinition? {
        all.first { $0.id == id }
    }
}
