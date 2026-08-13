import SwiftUI

/// Your intonation drawn over the model's.
///
/// Both contours are in semitones relative to each speaker's own median pitch,
/// so a low male TTS voice and a higher recording sit on the same axis and the
/// comparison is about melody rather than register.
struct PitchComparisonView: View {
    let modelContour: [Double?]
    let attemptContour: [Double?]
    var height: CGFloat = 120

    private let resolution = 160

    var body: some View {
        let model = AudioAnalysis.resample(AudioAnalysis.relativeSemitones(modelContour), to: resolution)
        let attempt = AudioAnalysis.resample(AudioAnalysis.relativeSemitones(attemptContour), to: resolution)
        let range = semitoneRange(model + attempt)

        VStack(alignment: .leading, spacing: 8) {
            Canvas { context, size in
                drawGuides(context: context, size: size, range: range)
                draw(contour: model, in: &context, size: size, range: range, color: .accentColor, width: 2.5)
                draw(contour: attempt, in: &context, size: size, range: range, color: .orange, width: 2.5)
            }
            .frame(height: height)
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))

            HStack(spacing: 16) {
                legend("Model", .accentColor)
                legend("You", .orange)
                Spacer()
                Text("relative pitch")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func legend(_ title: String, _ color: Color) -> some View {
        HStack(spacing: 5) {
            Capsule().fill(color).frame(width: 14, height: 3)
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func semitoneRange(_ values: [Double?]) -> ClosedRange<Double> {
        let voiced = values.compactMap { $0 }
        guard let low = voiced.min(), let high = voiced.max(), high > low else { return -6...6 }
        let padding = max(1, (high - low) * 0.15)
        return (low - padding)...(high + padding)
    }

    private func drawGuides(context: GraphicsContext, size: CGSize, range: ClosedRange<Double>) {
        // The zero line is each speaker's own median — the reference both
        // contours are measured against.
        guard range.contains(0) else { return }
        let y = yPosition(for: 0, in: size, range: range)
        var path = Path()
        path.move(to: CGPoint(x: 0, y: y))
        path.addLine(to: CGPoint(x: size.width, y: y))
        context.stroke(path, with: .color(.secondary.opacity(0.25)), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
    }

    private func draw(
        contour: [Double?],
        in context: inout GraphicsContext,
        size: CGSize,
        range: ClosedRange<Double>,
        color: Color,
        width: CGFloat
    ) {
        guard contour.count > 1 else { return }
        let step = size.width / CGFloat(contour.count - 1)

        // Unvoiced frames break the line rather than being drawn through,
        // so consonants and pauses don't invent pitch that wasn't there.
        var path = Path()
        var penIsDown = false

        for (index, value) in contour.enumerated() {
            guard let value else {
                penIsDown = false
                continue
            }
            let point = CGPoint(x: CGFloat(index) * step, y: yPosition(for: value, in: size, range: range))
            if penIsDown {
                path.addLine(to: point)
            } else {
                path.move(to: point)
                penIsDown = true
            }
        }

        context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
    }

    private func yPosition(for value: Double, in size: CGSize, range: ClosedRange<Double>) -> CGFloat {
        let span = range.upperBound - range.lowerBound
        guard span > 0 else { return size.height / 2 }
        let normalised = (value - range.lowerBound) / span
        return size.height - CGFloat(normalised) * size.height
    }
}
