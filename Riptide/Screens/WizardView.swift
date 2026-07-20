import SwiftUI
import SwiftData
import RiptideCore

struct WizardView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    var onDone: () -> Void = {}

    private enum Step: Equatable {
        case effort, days, muscles, exercises(Int) // index into chosen muscles
    }

    @State private var step: Step = .effort
    @State private var effort: Effort = .optimal
    @State private var days: Int = 0
    @State private var muscles: [MuscleGroup] = []          // in displayOrder
    @State private var picked: [MuscleGroup: [ExerciseDefinition]] = [:]

    private var stepIndex: Int {
        switch step {
        case .effort: return 0
        case .days: return 1
        case .muscles: return 2
        case .exercises(let i): return 3 + i
        }
    }
    private var totalSteps: Int { 3 + max(muscles.count, 1) }

    private var progressFraction: Double {
        switch step {
        case .effort: return 0.25
        case .days: return 0.5
        case .muscles: return 0.75
        case .exercises(let i):
            return 0.75 + 0.25 * Double(i + 1) / Double(max(muscles.count, 1))
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header: back chevron + STEP X OF Y + progress bar
            VStack(spacing: 14) {
                HStack {
                    Button { back() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                            .frame(width: 38, height: 38)
                            .background(RoundedRectangle(cornerRadius: 12).stroke(Theme.strokeStrong))
                    }
                    .foregroundStyle(Theme.text)
                    Spacer()
                    Text("STEP \(stepIndex + 1) OF \(totalSteps)").eyebrow()
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.stroke)
                        Capsule().fill(Theme.accent)
                            .frame(width: geo.size.width * progressFraction)
                    }
                }
                .frame(height: 4)
                .animation(.easeOut(duration: 0.3), value: progressFraction)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    switch step {
                    case .effort: effortStep
                    case .days: daysStep
                    case .muscles: musclesStep
                    case .exercises(let i): exerciseStep(muscles[i], index: i)
                    }
                }
                .padding(20)
            }

            Button(nextLabel) { next() }
                .buttonStyle(AccentButtonStyle())
                .disabled(!canAdvance)
                .opacity(canAdvance ? 1 : 0.4)
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
    }

    // MARK: Steps

    private var effortStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            title("How hard do you want to push?", sub: "This sets your weekly training volume per muscle.")
            ForEach(Effort.allCases, id: \.self) { e in
                let chest = VolumeTable.weeklyRange(for: .chest, effort: e)
                optionCard(selected: effort == e) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(e.label).font(.system(size: 18, weight: .heavy))
                        Spacer()
                        Text("~\(chest.low)–\(chest.high) sets · chest")
                            .font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.accent)
                    }
                } sub: {
                    Text(effortBlurb(e)).font(.system(size: 13)).foregroundStyle(Theme.textDim)
                } action: {
                    effort = e
                    if !e.allowedDays.contains(days) { days = 0 }
                }
            }
        }
    }

    private func effortBlurb(_ e: Effort) -> String {
        switch e {
        case .minimal: return "Maintain and stay consistent on a tight schedule."
        case .optimal: return "The best growth-per-hour tradeoff. Most people, most of the time."
        case .maximal: return "Everything you can productively recover from."
        }
    }

    private var daysStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            title("How many days can you train?", sub: "Days, not weekdays — miss one and the plan just waits for you.")
            HStack(spacing: 10) {
                ForEach(Array(effort.allowedDays), id: \.self) { d in
                    Button {
                        days = d
                    } label: {
                        Text("\(d)")
                            .font(.system(size: 24, weight: .heavy))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                            .background(days == d ? Theme.accent.opacity(0.14) : Theme.card,
                                        in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16)
                                .stroke(days == d ? Theme.accent : Theme.stroke, lineWidth: 1.5))
                            .foregroundStyle(days == d ? Theme.accent : Theme.text)
                    }
                }
            }
        }
    }

    private var musclesStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            title("What do you want to train?", sub: "Pick every muscle group this program should cover.")
            FlowLayout(spacing: 9) {
                ForEach(MuscleGroup.displayOrder) { m in
                    let on = muscles.contains(m)
                    Button {
                        if on { muscles.removeAll { $0 == m } } else {
                            muscles = MuscleGroup.displayOrder.filter { muscles.contains($0) || $0 == m }
                        }
                    } label: {
                        Text(m.label)
                            .font(.system(size: 14, weight: .bold))
                            .padding(.horizontal, 18).padding(.vertical, 12)
                            .background(on ? Theme.accent.opacity(0.14) : Theme.card, in: Capsule())
                            .overlay(Capsule().stroke(on ? Theme.accent : Theme.stroke, lineWidth: 1.5))
                            .foregroundStyle(on ? Theme.accent : Theme.text)
                    }
                }
            }
        }
    }

    private func exerciseStep(_ muscle: MuscleGroup, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("MUSCLE \(index + 1) OF \(muscles.count)").eyebrow(Theme.accent)
            title(muscle.label, sub: "Pick the lifts you actually want to do. More picks = more variety in the rotation.")
            ForEach(ExerciseBank.exercises(for: muscle)) { ex in
                let on = picked[muscle, default: []].contains(ex)
                optionCard(selected: on) {
                    HStack(spacing: 12) {
                        Image(systemName: on ? "checkmark.square.fill" : "square")
                            .foregroundStyle(on ? Theme.accent : Theme.textFaint)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(ex.name).font(.system(size: 15, weight: .bold))
                            Text("\(ex.repRange) reps").font(.system(size: 12)).foregroundStyle(Theme.textFaint)
                        }
                        Spacer()
                    }
                } sub: { EmptyView() } action: {
                    if on { picked[muscle]?.removeAll { $0 == ex } }
                    else { picked[muscle, default: []].append(ex) }
                }
            }
        }
    }

    // MARK: Chrome helpers

    private func title(_ t: String, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(t).font(.system(size: 28, weight: .heavy)).lineSpacing(2)
            Text(sub).font(.system(size: 13)).foregroundStyle(Theme.textDim)
        }
    }

    private func optionCard<Main: View, Sub: View>(selected: Bool,
                                                   @ViewBuilder main: () -> Main,
                                                   @ViewBuilder sub: () -> Sub,
                                                   action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) { main(); sub() }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(selected ? Theme.accent.opacity(0.10) : Theme.card,
                            in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18)
                    .stroke(selected ? Theme.accent : Theme.stroke, lineWidth: 1.5))
        }
        .foregroundStyle(Theme.text)
        .padding(.bottom, 2)
    }

    // MARK: Flow

    private var canAdvance: Bool {
        switch step {
        case .effort: return true
        case .days: return days != 0
        case .muscles: return !muscles.isEmpty
        case .exercises(let i): return !picked[muscles[i], default: []].isEmpty
        }
    }

    private var nextLabel: String {
        if case .exercises(let i) = step, i == muscles.count - 1 { return "Build my program" }
        return "Continue"
    }

    private func next() {
        switch step {
        case .effort: step = .days
        case .days: step = .muscles
        case .muscles: step = .exercises(0)
        case .exercises(let i):
            if i < muscles.count - 1 { step = .exercises(i + 1) } else { finish() }
        }
    }

    private func back() {
        switch step {
        case .effort: dismiss()
        case .days: step = .effort
        case .muscles: step = .days
        case .exercises(let i): step = i == 0 ? .muscles : .exercises(i - 1)
        }
    }

    private func finish() {
        let selections = picked.filter { muscles.contains($0.key) }
        let input = GeneratorInput(effort: effort, days: days, selections: selections)
        let generated = ProgramGenerator.generate(input)
        let count = (try? context.fetchCount(FetchDescriptor<Program>())) ?? 0
        ProgramMaterializer.materialize(generated, named: "Block \(count + 1)", input: input, in: context)
        onDone()
        dismiss()
    }
}

/// Minimal wrapping layout for the muscle chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (i, frame) in result.frames.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                              proposal: ProposedViewSize(frame.size))
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var frames: [CGRect] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: maxWidth, height: y + rowHeight), frames)
    }
}
