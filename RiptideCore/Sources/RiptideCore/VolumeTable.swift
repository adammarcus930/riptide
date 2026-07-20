public struct SetRange: Equatable, Sendable {
    public let low: Int
    public let high: Int
    public init(_ low: Int, _ high: Int) { self.low = low; self.high = high }
}

public enum VolumeTable {
    /// Weekly set range per muscle per effort (spec §4).
    public static func weeklyRange(for muscle: MuscleGroup, effort: Effort) -> SetRange {
        let (min, opt, max): (SetRange, SetRange, SetRange)
        switch muscle {
        case .chest:      (min, opt, max) = (SetRange(5, 8),   SetRange(10, 14), SetRange(15, 20))
        case .lats:       (min, opt, max) = (SetRange(6, 9),   SetRange(12, 16), SetRange(17, 22))
        case .frontDelts: (min, opt, max) = (SetRange(0, 4),   SetRange(4, 8),   SetRange(10, 12))
        case .sideDelts:  (min, opt, max) = (SetRange(6, 10),  SetRange(12, 18), SetRange(20, 26))
        case .rearDelts:  (min, opt, max) = (SetRange(4, 8),   SetRange(10, 16), SetRange(18, 24))
        case .traps:      (min, opt, max) = (SetRange(4, 8),   SetRange(10, 16), SetRange(17, 24))
        case .quads:      (min, opt, max) = (SetRange(4, 8),   SetRange(9, 14),  SetRange(15, 20))
        case .hamstrings: (min, opt, max) = (SetRange(4, 6),   SetRange(8, 12),  SetRange(13, 18))
        case .calves:     (min, opt, max) = (SetRange(5, 8),   SetRange(10, 16), SetRange(18, 24))
        case .triceps:    (min, opt, max) = (SetRange(4, 8),   SetRange(10, 14), SetRange(16, 20))
        case .biceps:     (min, opt, max) = (SetRange(4, 8),   SetRange(10, 14), SetRange(16, 20))
        case .forearms:   (min, opt, max) = (SetRange(0, 3),   SetRange(4, 8),   SetRange(10, 14))
        case .abs:        (min, opt, max) = (SetRange(3, 6),   SetRange(6, 12),  SetRange(14, 18))
        }
        switch effort {
        case .minimal: return min
        case .optimal: return opt
        case .maximal: return max
        }
    }
}
