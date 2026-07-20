import SwiftUI
import SwiftData

struct LibraryView: View {
    @Query(sort: \Program.createdAt, order: .reverse) private var programs: [Program]
    @State private var showWizard = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("LIBRARY").eyebrow()
                Text("Programs").font(.system(size: 34, weight: .heavy))
                Text("One program is active at a time — switching keeps every block's logged progress.")
                    .font(.system(size: 13)).foregroundStyle(Theme.textDim)

                ForEach(programs, id: \.persistentModelID) { program in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(program.name).font(.system(size: 17, weight: .heavy))
                            Spacer()
                            Text(program.isActive ? "ACTIVE" : "")
                                .font(.system(size: 10, weight: .heavy)).kerning(1).foregroundStyle(Theme.accent)
                        }
                        Text("\(program.effort.label) · \(program.daysPerWeek) days")
                            .font(.system(size: 12)).foregroundStyle(Theme.textDim)
                        let done = program.completedDayCount
                        ProgressView(value: Double(done), total: Double(max(program.daysPerWeek, 1)))
                            .tint(Theme.accent)
                        Text("\(done) of \(program.daysPerWeek) days this cycle")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textFaint)
                        if !program.isActive {
                            Button("Make active") {
                                for p in programs { p.isActive = false }
                                program.isActive = true
                            }
                            .font(.system(size: 13, weight: .heavy))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.4)))
                            .foregroundStyle(Theme.accent)
                        }
                    }
                    .card()
                }

                Button("Build a new program") { showWizard = true }
                    .buttonStyle(AccentButtonStyle())
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .fullScreenCover(isPresented: $showWizard) { WizardView() }
    }
}
