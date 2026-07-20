import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            TodayView().tabItem { Label("Today", systemImage: "bolt.fill") }
            NavigationStack { ProgramView() }.tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
            Text("More").tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
        .background(Theme.bg)
    }
}
