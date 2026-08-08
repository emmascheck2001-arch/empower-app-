//
//  ContentView.swift
//  Empower Watch Watch App
//
//  Em~power on the wrist: today's phase-based workouts, pick one, guided detail.
//  Real data arrives from the phone over WatchConnectivity (see WATCH_APP_SPEC.md); until the
//  first payload lands we show a labelled sample so the UI is never empty. "Start workout" opens
//  the live heart-rate session (still a placeholder — that's the next build).
//

import SwiftUI

// MARK: - Brand
let empowerGold = Color(red: 0.78, green: 0.72, blue: 0.60)   // #c8b89a

// MARK: - Models
// Codable, decoding 1:1 from the phone payload documented in WATCH_APP_SPEC.md.
// `id` is intentionally omitted from CodingKeys: it's a client-side identity for SwiftUI's
// ForEach, not part of the wire format, so it keeps its default UUID on decode.

struct WatchExercise: Identifiable, Codable {
    var id = UUID()
    let name: String
    let guide: String     // weight or pace guide, e.g. "12–16 kg" or "conversational"
    let reps: String      // per-set target, e.g. "10 reps" or a duration like "35 min"
    var sets: Int? = nil  // number of sets (strength); nil/1 for cardio/yoga holds

    // decodeIfPresent for sets (optional) so a payload without it still decodes cleanly.
    enum CodingKeys: String, CodingKey { case name, guide, reps, sets }
}

struct WatchWorkout: Identifiable, Codable {
    var id = UUID()
    let activity: String  // Run / Walk / Cycle / Swim / Gym / Yoga / Pilates / HIIT / Rest
    let title: String
    let detail: String    // e.g. "Strength · recovery-leaning"
    let exercises: [WatchExercise]
    var recommended: Bool = false   // the phase-best option; shown first with a badge

    enum CodingKeys: String, CodingKey { case activity, title, detail, exercises, recommended }
}

struct TodayPlan: Codable {
    let phase: String                 // user-facing sub-phase, e.g. "Mid luteal"
    let workouts: [WatchWorkout]
    var date: String? = nil           // ISO yyyy-MM-dd the plan was built for (staleness check)
    var age: Int? = nil               // from the phone (for the heart-rate flag threshold)

    enum CodingKeys: String, CodingKey { case phase, workouts, date, age }
}

// TEMP sample — shown (labelled) only until the first real phone→watch payload arrives.
let sampleToday = TodayPlan(
    phase: "Luteal phase",
    workouts: [
        WatchWorkout(activity: "Gym", title: "Lower body", detail: "Strength · recovery-leaning",
                     exercises: [
                        WatchExercise(name: "Goblet squat", guide: "12–16 kg", reps: "10 reps", sets: 3),
                        WatchExercise(name: "Romanian deadlift", guide: "20–30 kg", reps: "8 reps", sets: 3),
                        WatchExercise(name: "Glute bridge", guide: "bodyweight", reps: "12 reps", sets: 3),
                     ]),
        WatchWorkout(activity: "Walk", title: "Zone 2 walk", detail: "35 min · easy pace",
                     exercises: [WatchExercise(name: "Steady walk", guide: "conversational", reps: "35 min", sets: 1)]),
        WatchWorkout(activity: "Yoga", title: "Restorative flow", detail: "20 min · calm",
                     exercises: [
                        WatchExercise(name: "Child's pose", guide: "breathe deep", reps: "2 min", sets: 1),
                        WatchExercise(name: "Cat–cow", guide: "slow, with breath", reps: "2 min", sets: 1),
                        WatchExercise(name: "Supine twist", guide: "each side", reps: "3 min", sets: 1),
                        WatchExercise(name: "Savasana", guide: "let go", reps: "5 min", sets: 1),
                     ]),
    ],
    age: 30
)

func activityIcon(_ a: String) -> String {
    switch a {
    case "Run": return "figure.run"
    case "Walk": return "figure.walk"
    case "Cycle": return "figure.outdoor.cycle"
    case "Swim": return "figure.pool.swim"
    case "Gym": return "dumbbell.fill"
    case "Yoga": return "figure.yoga"
    case "Pilates": return "figure.pilates"
    case "HIIT": return "flame.fill"
    case "Rest": return "moon.zzz.fill"
    default: return "figure.strengthtraining.traditional"
    }
}

// Phone's activity-picker order, so the watch grid mirrors the phone.
let ACTIVITY_ORDER = ["Walk", "Run", "Cycle", "Swim", "Gym", "Yoga", "Pilates", "HIIT", "Rest"]

// MARK: - Today (activity grid, like the phone)
struct ContentView: View {
    @EnvironmentObject private var store: PlanStore

    // Distinct activities present in today's plan, in the phone's grid order.
    private var activities: [String] {
        let present = Set(store.plan.workouts.map { $0.activity })
        return ACTIVITY_ORDER.filter { present.contains($0) }
    }
    private var recommended: WatchWorkout? { store.plan.workouts.first { $0.recommended } }

    private let cols = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    // Header
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Today").font(.title3.bold())
                        Text(store.plan.phase).font(.caption).foregroundStyle(empowerGold)
                    }

                    // Activity grid — pick an activity, exactly like the phone.
                    LazyVGrid(columns: cols, spacing: 6) {
                        ForEach(activities, id: \.self) { act in
                            NavigationLink(destination: ActivityView(activity: act, plan: store.plan)) {
                                VStack(spacing: 4) {
                                    Image(systemName: activityIcon(act))
                                        .font(.system(size: 20))
                                        .foregroundStyle(empowerGold)
                                    Text(act).font(.caption2).foregroundStyle(.primary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.gray.opacity(0.18))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // Recommended for her cycle — highlighted, right below the grid.
                    if let rec = recommended {
                        Text("RECOMMENDED FOR YOUR CYCLE")
                            .font(.system(size: 9, weight: .bold)).foregroundStyle(empowerGold).tracking(0.5)
                            .padding(.top, 4)
                        NavigationLink(destination: WorkoutDetailView(workout: rec, phase: store.plan.phase, age: store.plan.age ?? 30)) {
                            HStack(spacing: 10) {
                                Image(systemName: activityIcon(rec.activity)).foregroundStyle(empowerGold).frame(width: 22)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(rec.title).font(.headline)
                                    Text(rec.detail).font(.caption2).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(10)
                            .background(empowerGold.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }

                    if !store.hasLiveData {
                        Text("Sample plan — open Em~power on your iPhone to sync today's workouts.")
                            .font(.caption2).foregroundStyle(.secondary).padding(.top, 4)
                    }
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("Em~power")
        }
        .tint(empowerGold)
    }
}

// MARK: - Activity screen (the workouts for one picked activity)
// Gym shows Full body / Upper body / Lower body; other activities usually have a single session.
struct ActivityView: View {
    let activity: String
    let plan: TodayPlan
    private var items: [WatchWorkout] { plan.workouts.filter { $0.activity == activity } }

    var body: some View {
        List {
            ForEach(items) { w in
                NavigationLink(destination: WorkoutDetailView(workout: w, phase: plan.phase, age: plan.age ?? 30)) {
                    VStack(alignment: .leading, spacing: 2) {
                        if w.recommended {
                            Text("RECOMMENDED")
                                .font(.system(size: 9, weight: .bold)).foregroundStyle(empowerGold).tracking(0.5)
                        }
                        Text(w.title).font(.headline)
                        Text(w.detail).font(.caption2).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle(activity)
    }
}

// MARK: - Workout detail
struct WorkoutDetailView: View {
    let workout: WatchWorkout
    let phase: String
    let age: Int

    var body: some View {
        List {
            // Activity image — a large brand-gold symbol for the workout type.
            HStack {
                Spacer()
                Image(systemName: activityIcon(workout.activity))
                    .font(.system(size: 40))
                    .foregroundStyle(empowerGold)
                    .padding(.vertical, 4)
                Spacer()
            }
            .listRowBackground(Color.clear)

            // Guidance-only card (no per-exercise breakdown synced yet): show the day's detail.
            if workout.exercises.isEmpty {
                Text(workout.detail)
                    .font(.callout)
                    .foregroundStyle(.primary)
                    .padding(.vertical, 2)
            }

            ForEach(workout.exercises) { e in
                VStack(alignment: .leading, spacing: 3) {
                    Text(e.name).font(.headline)
                    HStack {
                        Label(e.guide, systemImage: "scalemass")
                        if !e.reps.isEmpty {
                            Spacer()
                            Text(e.reps).foregroundStyle(empowerGold)
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 1)
            }

            NavigationLink(destination: LiveWorkoutView(workout: workout, phase: phase, age: age)) {
                Label("Start guided workout", systemImage: "play.fill")
                    .font(.headline)
                    .foregroundStyle(empowerGold)
            }
        }
        .navigationTitle(workout.title)
    }
}

#Preview {
    ContentView().environmentObject(PlanStore.preview)
}
