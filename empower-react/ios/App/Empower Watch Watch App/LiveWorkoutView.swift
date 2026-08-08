//
//  LiveWorkoutView.swift
//  Empower Watch Watch App
//
//  The guided workout player. Steps through the day's exercises SET BY SET with a rest timer
//  between sets and an animated stick-figure demo of each move. Heart rate is monitored silently
//  in the background and only surfaces as a FLAG banner when it's genuinely high for the user's
//  phase (WorkoutManager.hrFlag). Guide the workout; keep HR out of the way until it matters.
//

import SwiftUI
import Combine

// One exercise in the guided flow, with its set count. A guidance-only day (no per-move
// breakdown) collapses to a single one-set step built from the workout's detail line.
struct GuidedExercise: Identifiable {
    let id = UUID()
    let name: String
    let reps: String     // per-set target, e.g. "10 reps" or "35 min"
    let guide: String    // weight/pace, e.g. "12–16 kg"
    let sets: Int
}

func guidedExercises(_ w: WatchWorkout) -> [GuidedExercise] {
    if w.exercises.isEmpty {
        return [GuidedExercise(name: w.title, reps: w.detail, guide: "", sets: 1)]
    }
    return w.exercises.map {
        GuidedExercise(name: $0.name, reps: $0.reps, guide: $0.guide, sets: max(1, $0.sets ?? 1))
    }
}

struct LiveWorkoutView: View {
    let workout: WatchWorkout
    let phase: String
    let age: Int

    @StateObject private var manager = WorkoutManager()
    @Environment(\.dismiss) private var dismiss

    @State private var exIdx = 0
    @State private var setIdx = 0
    @State private var resting = false
    @State private var restRemaining = 0
    @State private var finished = false

    private let restSeconds = 45
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var exercises: [GuidedExercise] { guidedExercises(workout) }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                // The ONE place heart rate appears: a flag when it's high for the phase.
                if let flag = manager.hrFlag {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "heart.fill").foregroundStyle(.red)
                        Text(flag).font(.caption2).foregroundStyle(.primary)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.red.opacity(0.18)))
                }

                if finished { completeView }
                else if resting { restView }
                else { exerciseView }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle(workout.title)
        .onAppear {
            manager.requestAuthorization()
            manager.start(age: age, phase: phase)
        }
        .onDisappear { manager.end() }
        .onReceive(tick) { _ in
            guard resting else { return }
            if restRemaining > 1 { restRemaining -= 1 } else { advanceAfterRest() }
        }
    }

    // MARK: Active set
    private var exerciseView: some View {
        let ex = exercises[exIdx]
        return VStack(spacing: 7) {
            HStack {
                Text("Exercise \(exIdx + 1)/\(exercises.count)")
                    .font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text(manager.elapsedString).font(.caption2.monospacedDigit()).foregroundStyle(empowerGold)
            }

            StickFigureView(type: svgType(for: ex.name)).frame(height: 78)

            Text(ex.name).font(.headline).multilineTextAlignment(.center)

            if ex.sets > 1 {
                Text("Set \(setIdx + 1) of \(ex.sets)").font(.caption).foregroundStyle(empowerGold)
            }
            Text(ex.guide.isEmpty ? ex.reps : "\(ex.reps) · \(ex.guide)")
                .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)

            Button(action: completeSet) {
                Label(ex.sets > 1 ? "Complete set" : "Done", systemImage: "checkmark")
                    .font(.headline).foregroundStyle(empowerGold)
            }
            .padding(.top, 2)

            Button("End workout", role: .destructive) { finish() }.font(.caption2)
        }
    }

    // MARK: Rest
    private var restView: some View {
        VStack(spacing: 8) {
            Text("Rest").font(.caption).foregroundStyle(.secondary)
            Text("\(restRemaining)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(empowerGold).contentTransition(.numericText())
            let ex = exercises[exIdx]
            Text("Next: \(ex.name) · set \(setIdx + 2) of \(ex.sets)")
                .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button("Skip rest") { advanceAfterRest() }.font(.caption).foregroundStyle(empowerGold)
        }
        .padding(.vertical, 6)
    }

    // MARK: Complete
    private var completeView: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(empowerGold).imageScale(.large)
            Text("Workout complete").font(.headline)
            if manager.averageHeartRate > 0 {
                Text("Avg HR \(Int(manager.averageHeartRate)) bpm · \(manager.elapsedString)")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Button("Done") { dismiss() }.font(.headline).foregroundStyle(empowerGold).padding(.top, 2)
        }
        .padding(.vertical, 8)
    }

    // MARK: Flow
    private func completeSet() {
        let ex = exercises[exIdx]
        if setIdx + 1 < ex.sets {
            resting = true; restRemaining = restSeconds        // rest between sets
        } else if exIdx + 1 < exercises.count {
            exIdx += 1; setIdx = 0                              // next exercise (no rest)
        } else {
            finish()
        }
    }

    private func advanceAfterRest() {
        resting = false
        setIdx += 1
    }

    private func finish() {
        manager.end()
        finished = true
    }
}

#Preview {
    LiveWorkoutView(
        workout: WatchWorkout(activity: "Gym", title: "Lower body", detail: "Strength",
            exercises: [
                WatchExercise(name: "Goblet squat", guide: "12–16 kg", reps: "10 reps", sets: 3),
                WatchExercise(name: "Romanian deadlift", guide: "20–30 kg", reps: "8 reps", sets: 3),
            ]),
        phase: "Mid luteal", age: 30)
}
