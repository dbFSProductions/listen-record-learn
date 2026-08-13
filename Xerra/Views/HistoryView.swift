import SwiftUI

/// Every attempt at one phrase, newest first — so you can hear last month's
/// you against today's.
struct HistoryView: View {
    let phrase: Phrase

    @Environment(Library.self) private var library
    @Environment(\.dismiss) private var dismiss
    @State private var player = Player()

    private var attempts: [Attempt] { library.attempts(for: phrase.id) }

    var body: some View {
        List {
            if let trend {
                Section("Progress") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(trend.summary).font(.subheadline)
                        ScoreTrendChart(scores: trend.scores)
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("Attempts") {
                ForEach(attempts) { attempt in
                    HStack(spacing: 12) {
                        Button {
                            player.play(url: attempt.url, track: .attempt)
                        } label: {
                            Image(systemName: "play.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.orange)
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(attempt.recordedAt, format: .dateTime.day().month().hour().minute())
                                .font(.subheadline)
                            Text(attempt.engine.rawValue)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }

                        Spacer()

                        if let overall = attempt.overall {
                            Text("\(Int(overall.rounded()))")
                                .font(.headline.monospacedDigit())
                                .foregroundStyle(overall >= 80 ? .green : overall >= 60 ? .yellow : .orange)
                        }
                    }
                }
                .onDelete { offsets in
                    for index in offsets where attempts.indices.contains(index) {
                        library.delete(attempts[index])
                    }
                }
            }
        }
        .navigationTitle(phrase.text)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .overlay {
            if attempts.isEmpty {
                ContentUnavailableView(
                    "No attempts yet",
                    systemImage: "mic.slash",
                    description: Text("Record this phrase and it'll build up here.")
                )
            }
        }
        .onDisappear { player.stop() }
    }

    private var trend: (scores: [Double], summary: String)? {
        // Oldest first so the chart reads left to right in time.
        let scores = attempts.reversed().compactMap(\.overall)
        guard scores.count >= 2 else { return nil }
        let change = scores.last! - scores.first!
        let summary: String = switch change {
        case 5...: "Up \(Int(change.rounded())) points since your first go."
        case ..<(-5): "Down \(Int(abs(change).rounded())) points since your first go — worth slowing back down."
        default: "Holding steady around \(Int((scores.reduce(0, +) / Double(scores.count)).rounded()))."
        }
        return (scores, summary)
    }
}

/// A small sparkline of scores over time.
private struct ScoreTrendChart: View {
    let scores: [Double]

    var body: some View {
        Canvas { context, size in
            guard scores.count > 1 else { return }
            let step = size.width / CGFloat(scores.count - 1)

            var path = Path()
            for (index, score) in scores.enumerated() {
                let point = CGPoint(
                    x: CGFloat(index) * step,
                    y: size.height - CGFloat(score / 100) * size.height
                )
                if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
            }
            context.stroke(
                path,
                with: .color(.accentColor),
                style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
            )

            for (index, score) in scores.enumerated() {
                let point = CGPoint(
                    x: CGFloat(index) * step,
                    y: size.height - CGFloat(score / 100) * size.height
                )
                let dot = CGRect(x: point.x - 2.5, y: point.y - 2.5, width: 5, height: 5)
                context.fill(Path(ellipseIn: dot), with: .color(.accentColor))
            }
        }
        .frame(height: 54)
    }
}
