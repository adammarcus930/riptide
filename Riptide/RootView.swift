import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            Text("Today").tabItem { Label("Today", systemImage: "bolt.fill") }
            Text("Program").tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
            Text("More").tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
        .background(Theme.bg)
    }
}
