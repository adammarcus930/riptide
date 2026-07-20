import Foundation

public enum Effort: String, Codable, CaseIterable, Sendable {
    case minimal, optimal, maximal

    public var label: String { rawValue.capitalized }

    public var allowedDays: ClosedRange<Int> {
        switch self {
        case .minimal: return 2...7
        case .optimal: return 4...7
        case .maximal: return 5...7
        }
    }
}
