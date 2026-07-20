import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            WizardHost().tabItem { Label("Today", systemImage: "bolt.fill") }
            Text("Program").tabItem { Label("Program", systemImage: "list.bullet.rectangle") }
            Text("More").tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
        .background(Theme.bg)
    }
}

private struct WizardHost: View {
    @State private var showWizard = false
    var body: some View {
        Button("Build my program") { showWizard = true }
            .buttonStyle(AccentButtonStyle())
            .padding(40)
            .fullScreenCover(isPresented: $showWizard) { WizardView() }
    }
}
