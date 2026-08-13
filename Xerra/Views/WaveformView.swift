import SwiftUI

/// A single waveform envelope drawn as a mirrored bar chart.
struct WaveformView: View {
    let envelope: [Float]
    var color: Color
    /// 0...1 playback position, drawn as a moving line.
    var progress: Double?
    var height: CGFloat = 56

    var body: some View {
        Canvas { context, size in
            guard !envelope.isEmpty else { return }
            let barWidth = size.width / CGFloat(envelope.count)
            let midY = size.height / 2

            for (index, value) in envelope.enumerated() {
                // A floor of 1pt keeps silent stretches visible as a hairline
                // rather than vanishing, so the clip's full length reads.
                let barHeight = max(1, CGFloat(value) * size.height * 0.95)
                let x = CGFloat(index) * barWidth
                let rect = CGRect(
                    x: x,
                    y: midY - barHeight / 2,
                    width: max(0.8, barWidth - 0.8),
                    height: barHeight
                )
                context.fill(Path(roundedRect: rect, cornerRadius: barWidth / 3), with: .color(color))
            }

            if let progress {
                let x = size.width * CGFloat(min(max(progress, 0), 1))
                var line = Path()
                line.move(to: CGPoint(x: x, y: 0))
                line.addLine(to: CGPoint(x: x, y: size.height))
                context.stroke(line, with: .color(.primary.opacity(0.55)), lineWidth: 1.5)
            }
        }
        .frame(height: height)
    }
}

/// The model clip and your attempt stacked on a shared x-axis, so differences
/// in length and rhythm are visible at a glance.
struct WaveformComparison: View {
    let modelEnvelope: [Float]
    let attemptEnvelope: [Float]
    var timingRatio: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            labelled("Model", color: .accentColor, envelope: modelEnvelope)
            labelled("You", color: .orange, envelope: attemptEnvelope)

            if let timingRatio {
                Label(timingDescription(timingRatio), systemImage: "metronome")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func labelled(_ title: String, color: Color, envelope: [Float]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(color)
            if envelope.isEmpty {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.secondary.opacity(0.12))
                    .frame(height: 56)
                    .overlay(Text("—").foregroundStyle(.tertiary))
            } else {
                WaveformView(envelope: envelope, color: color)
            }
        }
    }

    private func timingDescription(_ ratio: Double) -> String {
        switch ratio {
        case ..<0.8: "You're about \(Int((1 - ratio) * 100))% quicker than the model."
        case 0.8..<1.2: "Your timing is close to the model — nicely matched."
        case 1.2..<1.6: "You're about \(Int((ratio - 1) * 100))% slower than the model."
        default: "You're taking roughly \(String(format: "%.1f", ratio))× as long as the model. Try running the words together more."
        }
    }
}
