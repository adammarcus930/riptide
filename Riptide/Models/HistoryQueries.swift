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
