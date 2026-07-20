import SwiftUI

enum Theme {
    static let bg        = Color(hex: 0x0D1013)
    static let bg2       = Color(hex: 0x111820)
    static let desk      = Color(hex: 0x080B0E)
    static let card      = Color(hex: 0x161B21)
    static let cardHover = Color(hex: 0x1B2129)
    static let inputBg   = Color(hex: 0x1C232B)
    static let accent    = Color(hex: 0x43C9FF)
    static let accentHover = Color(hex: 0x6FD7FF)
    static let onAccent  = Color(hex: 0x04141D)
    static let text      = Color(hex: 0xEEF3F7)

    static let textDim   = text.opacity(0.5)
    static let textFaint = text.opacity(0.45)
    static let stroke    = Color.white.opacity(0.08)
    static let strokeStrong = Color.white.opacity(0.12)
    static let strokeDashed = Color.white.opacity(0.22)
    static let strokeDashedFaint = Color.white.opacity(0.18)
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

/// Card container matching the design's 18pt-radius bordered cards.
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.stroke))
    }
}

/// Full-width accent CTA matching the design's primary buttons.
struct AccentButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .heavy))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
            .foregroundStyle(Theme.onAccent)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

extension View {
    func card() -> some View { modifier(CardStyle()) }
    /// Tiny uppercase tracked label ("NEXT UP", "ON DECK", …).
    func eyebrow(_ color: Color = Theme.textFaint) -> some View {
        font(.system(size: 11, weight: .heavy)).kerning(1.5).foregroundStyle(color)
    }
}
