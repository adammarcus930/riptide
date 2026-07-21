import SwiftUI
import SwiftData

/// Root of the Program tab: the list of all programs. Tap any one to view/edit
/// its days (no need to activate it first); the active program is just badged.
struct ProgramLibraryView: View {
    @Query(sort: \Program.createdAt, order: .reverse) private var programs: [Program]
    @State private var showWizard = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("LIBRARY").eyebrow()
                Text("Programs").font(.system(size: 34, weight: .heavy))
                Text("Tap a program to view or edit it. One is active at a time — the active one drives your Today tab; switching keeps every program's logged progress.")
                    .font(.system(size: 13)).foregroundStyle(Theme.textDim)

                if programs.isEmpty {
                    Text("No programs yet — build your first one below.")
                        .font(.system(size: 13)).foregroundStyle(Theme.textFaint)
                        .padding(.top, 4)
                }

                ForEach(programs, id: \.persistentModelID) { program in
                    NavigationLink(value: ProgramRef(id: program.persistentModelID)) {
                        row(program)
                    }
                    .buttonStyle(.plain)
                }

                Button("Build a new program") { showWizard = true }
                    .buttonStyle(AccentButtonStyle())
                    .padding(.top, 4)
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .fullScreenCover(isPresented: $showWizard) { WizardView() }
    }

    private func row(_ program: Program) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(program.name).font(.system(size: 17, weight: .heavy))
                Spacer()
                if program.isActive {
                    Text("ACTIVE").font(.system(size: 10, weight: .heavy)).kerning(1).foregroundStyle(Theme.accent)
                }
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textFaint)
            }
            Text("\(program.effort.label) · \(program.daysPerWeek) days")
                .font(.system(size: 12)).foregroundStyle(Theme.textDim)
            let done = program.completedDayCount
            ProgressView(value: Double(done), total: Double(max(program.daysPerWeek, 1)))
                .tint(Theme.accent)
            Text("\(done) of \(program.daysPerWeek) days this cycle")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textFaint)
        }
        .card()
    }
}
