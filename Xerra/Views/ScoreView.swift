import SwiftUI

/// The scorecard for one attempt: headline number, the sub-scores the engine
/// gave, and a word-by-word breakdown you can tap into for phoneme detail.
struct ScoreView: View {
    let attempt: Attempt
    var didFallBack: Bool = false

    @State private var expandedWord: WordScore.ID?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            if !attempt.words.isEmpty {
                wordBreakdown
            }

            if let transcript = attempt.transcript, !transcript.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Heard").font(.caption2.weight(.semibold)).foregroundStyle(.tertiary)
                    Text(transcript).font(.callout).foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 6) {
                Image(systemName: attempt.engine == .azure ? "waveform.badge.magnifyingglass" : "iphone.gen3")
                Text(attempt.engine.rawValue)
                if didFallBack {
                    Text("· Azure unavailable, scored on-device")
                        .foregroundStyle(.orange)
                }
            }
            .font(.caption2)
            .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 18) {
            if let overall = attempt.overall {
                ZStack {
                    Circle()
                        .stroke(Color.secondary.opacity(0.15), lineWidth: 7)
                    Circle()
                        .trim(from: 0, to: overall / 100)
                        .stroke(color(for: overall), style: StrokeStyle(lineWidth: 7, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(Int(overall.rounded()))")
                        .font(.title2.weight(.bold).monospacedDigit())
                }
                .frame(width: 66, height: 66)
            }

            VStack(alignment: .leading, spacing: 5) {
                if let overall = attempt.overall {
                    Text(verdict(for: overall))
                        .font(.subheadline.weight(.semibold))
                }
                HStack(spacing: 14) {
                    subScore("Accuracy", attempt.accuracy)
                    subScore("Fluency", attempt.fluency)
                    subScore("Complete", attempt.completeness)
                }
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func subScore(_ title: String, _ value: Double?) -> some View {
        if let value {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption2).foregroundStyle(.tertiary)
                Text("\(Int(value.rounded()))").font(.footnote.weight(.medium).monospacedDigit())
            }
        }
    }

    // MARK: - Words

    private var wordBreakdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Word by word")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)

            FlowLayout(spacing: 6) {
                ForEach(attempt.words) { word in
                    Button {
                        guard !word.phonemes.isEmpty else { return }
                        expandedWord = expandedWord == word.id ? nil : word.id
                    } label: {
                        Text(word.word)
                            .font(.callout.weight(.medium))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(background(for: word), in: Capsule())
                            .foregroundStyle(word.isProblem ? Color.primary : Color.primary.opacity(0.85))
                    }
                    .buttonStyle(.plain)
                }
            }

            if let expandedWord, let word = attempt.words.first(where: { $0.id == expandedWord }) {
                phonemeDetail(for: word)
            }
        }
    }

    private func phonemeDetail(for word: WordScore) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Sounds in “\(word.word)”")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
            FlowLayout(spacing: 5) {
                ForEach(word.phonemes) { phoneme in
                    VStack(spacing: 1) {
                        Text(phoneme.phoneme).font(.caption.monospaced())
                        if let score = phoneme.score {
                            Text("\(Int(score.rounded()))")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(color(for: score))
                        }
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
    }

    private func background(for word: WordScore) -> Color {
        guard let score = word.score else { return .secondary.opacity(0.12) }
        return color(for: score).opacity(0.22)
    }

    private func color(for score: Double) -> Color {
        switch score {
        case 80...: .green
        case 60..<80: .yellow
        default: .red
        }
    }

    private func verdict(for score: Double) -> String {
        switch score {
        case 90...: "That's the one — say it just like that."
        case 80..<90: "Close. A native would follow you without effort."
        case 60..<80: "Understandable, but the tinted words need work."
        case 40..<60: "Some of it landed. Play the model again and copy the rhythm."
        default: "Not there yet. Slow it down and go word by word."
        }
    }
}

/// A wrapping row layout for the word chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = arrange(subviews: subviews, in: width)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews: subviews, in: bounds.width)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, in width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let projected = current.width + (current.indices.isEmpty ? 0 : spacing) + size.width
            if projected > width && !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.indices.append(index)
            current.width += (current.indices.count == 1 ? 0 : spacing) + size.width
            current.height = max(current.height, size.height)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
