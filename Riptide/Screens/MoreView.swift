import SwiftUI

struct MoreView: View {
    @AppStorage("restAlertSec") private var restAlertSec = 90

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("MORE").eyebrow()
                Text("Riptide").font(.system(size: 34, weight: .heavy))

                NavigationLink { HistoryView() } label: {
                    HStack {
                        Label("History", systemImage: "clock.arrow.circlepath")
                            .font(.system(size: 15, weight: .bold))
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Theme.textFaint)
                    }
                    .card()
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 10) {
                    Text("REST TIMER ALERT").eyebrow()
                    HStack {
                        Text("\(restAlertSec) seconds").font(.system(size: 15, weight: .bold))
                        Spacer()
                        Stepper("", value: $restAlertSec, in: 30...300, step: 15).labelsHidden()
                    }
                }
                .card()
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .foregroundStyle(Theme.text)
    }
}
