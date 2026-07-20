import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            TodayDestinationHost().tabItem { Label("Today", systemImage: "bolt.fill") }
            NavigationStack { ProgramView() }.tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
            Text("More").tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
        .background(Theme.bg)
    }
}

/// Owns the Today tab's own navigation stack so pushing a day detail
/// doesn't nest inside the tab bar's implicit stack.
struct TodayDestinationHost: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            TodayView { day in path.append(DayRef(id: day.persistentModelID)) }
                .navigationDestination(for: DayRef.self) { ref in
                    DayDestination(id: ref.id)
                }
        }
    }
}
