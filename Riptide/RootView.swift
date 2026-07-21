import SwiftUI
import SwiftData

struct RootView: View {
    // Drives keep-awake only (no visible banner): the screen stays on while a
    // workout session is open.
    @Query(filter: #Predicate<WorkoutSession> { $0.finishedAt == nil }) private var openSessions: [WorkoutSession]

    var body: some View {
        TabView {
            TodayDestinationHost()
                .tabItem { Label("Today", systemImage: "bolt.fill") }
            NavigationStack {
                ProgramLibraryView()
                    .navigationDestination(for: ProgramRef.self) { ProgramDestination(id: $0.id) }
                    .navigationDestination(for: DayRef.self) { DayDestination(id: $0.id) }
            }
            .tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
            NavigationStack { MoreView() }
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
        .background(Theme.bg)
        .onChange(of: openSessions.isEmpty, initial: true) { _, isEmpty in
            UIApplication.shared.isIdleTimerDisabled = !isEmpty   // keep-awake during workouts
        }
    }
}

/// Owns the Today tab's navigation stack so pushing a day detail doesn't nest
/// inside the tab bar's implicit stack.
struct TodayDestinationHost: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            TodayView { day in path.append(DayRef(id: day.persistentModelID)) }
                .navigationDestination(for: DayRef.self) { DayDestination(id: $0.id) }
        }
    }
}
