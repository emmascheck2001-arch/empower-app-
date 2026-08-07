//
//  LiveWorkoutView.swift
//  Empower Watch Watch App
//
//  The guided workout player. Steps through the day's exercises one at a time with a running
//  timer, while heart rate is monitored silently in the background and only surfaces as a FLAG
//  banner when it's genuinely high for the user's phase (WorkoutManager.hrFlag). This matches the
//  design: guide the workout, keep HR out of the way until it matters.
//

import SwiftUI

// A single step in the guided flow. Built from the workout's exercises; a guidance-only day
// (e.g. a restorative flow with no per-move breakdown) collapses to one step.
struct GuidedStep: Identifiable {
    let id = UUID()
    let name: String
    let detail: String   // guide/pace + reps, or the day's one-line guidance
}

func stepsFor(_ workout: WatchWorkout) -> [GuidedStep] {
    if workout.exercises.isEmpty {
        return [GuidedStep(name: workout.title, detail: workout.detail)]
    }
    return workout.exercises.map { e in
        let d = e.reps.isEmpty ? e.guide : "\(e.reps) · \(e.guide)"
        return GuidedStep(name: e.name, detail: d)
    }
}

struct LiveWorkoutView: View {
    let workout: WatchWorkout
    let phase: String
    let age: Int

    @StateObject private var manager = WorkoutManager()
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var finished = false

    private var steps: [GuidedStep] { stepsFor(workout) }

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

                if finished {
                    completeView
                } else {
                    activeView
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle(workout.title)
        .onAppear {
            manager.requestAuthorization()
            manager.start(age: age, phase: phase)
        }
        .onDisappear { manager.end() }
    }

    // MARK: Active step
    private var activeView: some View {
        VStack(spacing: 10) {
            HStack {
                Text("Step \(index + 1) of \(steps.count)")
                    .font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text(manager.elapsedString).font(.caption2.monospacedDigit()).foregroundStyle(empowerGold)
            }

            let step = steps[index]
            VStack(spacing: 6) {
                // Animated stick-figure demo of THIS exercise (same as the phone app).
                StickFigureView(type: svgType(for: step.name))
                    .frame(height: 84)
                Text(step.name).font(.headline).multilineTextAlignment(.center)
                Text(step.detail).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)

            Button {
                if index + 1 < steps.count { index += 1 } else { finish() }
            } label: {
                Label(index + 1 < steps.count ? "Next" : "Finish",
                      systemImage: index + 1 < steps.count ? "arrow.right" : "checkmark")
                    .font(.headline).foregroundStyle(empowerGold)
            }

            if index + 1 < steps.count {
                Button("End workout", role: .destructive) { finish() }
                    .font(.caption2)
            }
        }
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

    private func finish() {
        manager.end()
        finished = true
    }
}

#Preview {
    LiveWorkoutView(
        workout: WatchWorkout(activity: "Gym", title: "Lower body", detail: "Strength",
            exercises: [
                WatchExercise(name: "Goblet squat", guide: "12–16 kg", reps: "3 × 10"),
                WatchExercise(name: "Romanian deadlift", guide: "20–30 kg", reps: "3 × 8"),
            ]),
        phase: "Mid luteal", age: 30)
}
