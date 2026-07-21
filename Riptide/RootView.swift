import SwiftUI
import SwiftData

private enum RootTab { case today, program, more }

struct RootView: View {
    @Query(filter: #Predicate<WorkoutSession> { $0.finishedAt == nil }) private var openSessions: [WorkoutSession]
    @State private var selectedTab: RootTab = .today
    @State private var todayPath = NavigationPath()

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                TodayDestinationHost(path: $todayPath)
                    .tabItem { Label("Today", systemImage: "bolt.fill") }
                    .tag(RootTab.today)
                NavigationStack {
                    ProgramLibraryView()
                        .navigationDestination(for: ProgramRef.self) { ProgramDestination(id: $0.id) }
                        .navigationDestination(for: DayRef.self) { DayDestination(id: $0.id) }
                }
                .tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
                .tag(RootTab.program)
                NavigationStack { MoreView() }
                    .tabItem { Label("More", systemImage: "ellipsis.circle") }
                    .tag(RootTab.more)
            }
            .tint(Theme.accent)

            if let session = openSessions.first {
                Button {
                    resume(session)
                } label: {
                    HStack(spacing: 12) {
                        Circle().fill(Theme.onAccent).frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("WORKOUT IN PROGRESS").font(.system(size: 9.5, weight: .heavy)).kerning(1)
                            Text("Day \(session.dayIndex + 1) · \(session.program?.name ?? "")")
                                .font(.system(size: 14, weight: .heavy)).lineLimit(1)
                        }
                        Spacer()
                        Text(session.startedAt, style: .timer)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                    }
                    .padding(.horizontal, 16).padding(.vertical, 13)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(Theme.onAccent)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.bottom, 58)
            }
        }
        .background(Theme.bg)
        .onChange(of: openSessions.isEmpty, initial: true) { _, isEmpty in
            UIApplication.shared.isIdleTimerDisabled = !isEmpty   // keep-awake during workouts
        }
    }

    /// Spec §7: tapping the in-progress banner returns to the workout — switch to the Today
    /// tab and push that session's day onto its stack (resetting any existing path first so
    /// repeated taps don't stack duplicate pushes).
    private func resume(_ session: WorkoutSession) {
        guard let day = session.program?.sortedDays.first(where: { $0.index == session.dayIndex }) else { return }
        selectedTab = .today
        todayPath = NavigationPath()
        todayPath.append(DayRef(id: day.persistentModelID))
    }
}

/// Owns the Today tab's own navigation stack so pushing a day detail
/// doesn't nest inside the tab bar's implicit stack. The path is hoisted into RootView so
/// the "workout in progress" banner can push a destination onto it from outside the tab.
struct TodayDestinationHost: View {
    @Binding var path: NavigationPath
    var body: some View {
        NavigationStack(path: $path) {
            TodayView { day in path.append(DayRef(id: day.persistentModelID)) }
                .navigationDestination(for: DayRef.self) { ref in
                    DayDestination(id: ref.id)
                }
        }
    }
}
