import Foundation

public enum MuscleGroup: String, Codable, CaseIterable, Identifiable, Sendable {
    case chest, lats, shoulders, traps, quads, hamstrings, calves
    case triceps, biceps, forearms, abs

    public var id: String { rawValue }
    public var label: String { rawValue.capitalized }

    /// Allocated first; their exercises grant secondary credit.
    public static let givers: [MuscleGroup] = [.chest, .lats, .shoulders, .traps, .quads, .hamstrings, .calves]
    /// Allocated second; direct targets reduced by earned credits.
    public static let receivers: [MuscleGroup] = [.triceps, .biceps, .forearms, .abs]
    /// Generator processing order (spec §5 step 2).
    public static let processingOrder: [MuscleGroup] = givers + receivers
    /// Wizard chips and within-day lift ordering (design PARTS order).
    public static let displayOrder: [MuscleGroup] = [.quads, .hamstrings, .chest, .lats, .shoulders, .traps, .triceps, .biceps, .forearms, .calves, .abs]
}
