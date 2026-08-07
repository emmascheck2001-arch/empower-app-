//
//  StickFigure.swift
//  Empower Watch Watch App
//
//  Animated stick-figure exercise demos — a faithful SwiftUI port of the phone app's
//  Workout.jsx StickFigure/POSES system. Each exercise is two real poses (start ↔ working)
//  given as joint coordinates in a 240×175 space; a Canvas interpolates between them every
//  frame so the figure performs the rep. Same coordinate data and brand palette as the phone.
//

import SwiftUI

// Which figure to draw for a given exercise name (ported from getSvgType). Order matters —
// more specific matches first.
func svgType(for name: String) -> String {
    let n = name.lowercased()
    // Yoga / mobility poses (watch-only additions — the phone's set is strength-focused).
    if n.contains("child") { return "childpose" }
    if n.contains("cat") { return "catcow" }
    if n.contains("savasana") || n.contains("corpse") { return "savasana" }
    if n.contains("supine") { return "twistpose" }
    if n.contains("bulgarian") || n.contains("split squat") { return "splitsquat" }
    if n.contains("squat") || n.contains("goblet") { return "squat" }
    if n.contains("leg press") { return "legpress" }
    if n.contains("deadlift") { return "hinge" }
    if n.contains("lateral raise") || n.contains("rear delt") || (n.contains("fly") && !n.contains("chest")) || n.contains("front raise") { return "lateralraise" }
    if n.contains("pulldown") { return "pullup" }
    if n.contains("bench press") || n.contains("push-up") || (n.contains("incline") && !n.contains("curl")) || n.contains("chest press") || n.contains("chest fly") { return "push" }
    if n.contains("face pull") || n.contains("pull-apart") { return "facepull" }
    if n.contains("row") && !n.contains("pull") { return "row" }
    if n.contains("overhead press") || n.contains("shoulder press") { return "press" }
    if n.contains("lunge") { return "lunge" }
    if n.contains("hip thrust") || n.contains("glute bridge") { return "thrust" }
    if n.contains("pull-up") || n.contains("pull up") || n.contains("chin") { return "pullup" }
    if n.contains("leg curl") || n.contains("nordic") || n.contains("hamstring curl") { return "legcurl" }
    if n.contains("pushdown") || n.contains("tricep extension") { return "pushdown" }
    if n.contains("dip") { return "dip" }
    if n.contains("curl") && !n.contains("calf") { return "curl" }
    if n.contains("leg raise") || n.contains("hanging") { return "legraise" }
    if n.contains("plank") || n.contains("crunch") || n.contains("dead bug") || n.contains("twist") || n.contains("bicycle") || n.contains("mountain climber") { return "plank" }
    if n.contains("calf") { return "calf" }
    return "stand"
}

private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }

struct Pose {
    var j: [String: CGPoint]              // head,neck,hip,k1,f1,k2,f2,e1,h1,e2,h2
    var bar: (CGPoint, CGPoint)? = nil
}

struct ExerciseFigure {
    var floor: Bool = false
    var bench: (CGFloat, CGFloat, CGFloat)? = nil   // x, y, width
    var period: Double = 2400                        // ms
    var top: Pose
    var bottom: Pose
}

// Exact pose data ported from Workout.jsx POSES.
let FIGURES: [String: ExerciseFigure] = [
    "squat": ExerciseFigure(floor: true, period: 2600,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,110),"k1":pt(112,135),"f1":pt(110,160),"k2":pt(128,135),"f2":pt(130,160),"e1":pt(106,60),"h1":pt(98,54),"e2":pt(134,60),"h2":pt(142,54)], bar: (pt(94,52),pt(146,52))),
        bottom: Pose(j: ["head":pt(120,58),"neck":pt(120,76),"hip":pt(116,116),"k1":pt(95,132),"f1":pt(108,160),"k2":pt(141,132),"f2":pt(132,160),"e1":pt(104,78),"h1":pt(96,72),"e2":pt(136,78),"h2":pt(144,72)], bar: (pt(92,70),pt(148,70)))),
    "hinge": ExerciseFigure(floor: true, period: 2800,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,110),"k1":pt(116,135),"f1":pt(114,160),"k2":pt(127,135),"f2":pt(129,160),"e1":pt(119,84),"h1":pt(117,110),"e2":pt(125,84),"h2":pt(123,110)], bar: (pt(100,112),pt(140,112))),
        bottom: Pose(j: ["head":pt(74,62),"neck":pt(90,68),"hip":pt(138,104),"k1":pt(140,130),"f1":pt(138,160),"k2":pt(150,130),"f2":pt(150,160),"e1":pt(102,96),"h1":pt(104,138),"e2":pt(108,98),"h2":pt(110,140)], bar: (pt(86,139),pt(122,141)))),
    "push": ExerciseFigure(floor: true, bench: (36,116,168), period: 2400,
        top: Pose(j: ["head":pt(58,100),"neck":pt(80,103),"hip":pt(150,107),"k1":pt(168,124),"f1":pt(164,158),"k2":pt(178,124),"f2":pt(184,158),"e1":pt(92,86),"h1":pt(94,62),"e2":pt(112,86),"h2":pt(114,62)], bar: (pt(82,60),pt(126,60))),
        bottom: Pose(j: ["head":pt(58,100),"neck":pt(80,103),"hip":pt(150,107),"k1":pt(168,124),"f1":pt(164,158),"k2":pt(178,124),"f2":pt(184,158),"e1":pt(86,98),"h1":pt(80,86),"e2":pt(114,98),"h2":pt(120,86)], bar: (pt(74,84),pt(126,84)))),
    "row": ExerciseFigure(floor: true, period: 2200,
        top: Pose(j: ["head":pt(70,52),"neck":pt(84,60),"hip":pt(146,104),"k1":pt(140,130),"f1":pt(134,160),"k2":pt(152,130),"f2":pt(158,160),"e1":pt(100,90),"h1":pt(96,130),"e2":pt(108,92),"h2":pt(104,132)], bar: (pt(84,130),pt(122,132))),
        bottom: Pose(j: ["head":pt(70,52),"neck":pt(84,60),"hip":pt(146,104),"k1":pt(140,130),"f1":pt(134,160),"k2":pt(152,130),"f2":pt(158,160),"e1":pt(104,84),"h1":pt(120,98),"e2":pt(112,86),"h2":pt(128,100)], bar: (pt(108,98),pt(142,100)))),
    "press": ExerciseFigure(floor: true, period: 2400,
        top: Pose(j: ["head":pt(120,46),"neck":pt(120,62),"hip":pt(120,112),"k1":pt(114,136),"f1":pt(112,160),"k2":pt(127,136),"f2":pt(129,160),"e1":pt(112,46),"h1":pt(104,24),"e2":pt(128,46),"h2":pt(136,24)], bar: (pt(100,22),pt(140,22))),
        bottom: Pose(j: ["head":pt(120,46),"neck":pt(120,62),"hip":pt(120,112),"k1":pt(114,136),"f1":pt(112,160),"k2":pt(127,136),"f2":pt(129,160),"e1":pt(106,66),"h1":pt(100,50),"e2":pt(134,66),"h2":pt(140,50)], bar: (pt(96,48),pt(144,48)))),
    "splitsquat": ExerciseFigure(floor: true, bench: (156,126,50), period: 2600,
        top: Pose(j: ["head":pt(100,42),"neck":pt(100,60),"hip":pt(100,108),"k1":pt(98,135),"f1":pt(96,160),"k2":pt(150,120),"f2":pt(178,128),"e1":pt(92,84),"h1":pt(90,110),"e2":pt(110,84),"h2":pt(108,110)]),
        bottom: Pose(j: ["head":pt(100,58),"neck":pt(100,76),"hip":pt(100,120),"k1":pt(90,138),"f1":pt(96,160),"k2":pt(150,150),"f2":pt(178,128),"e1":pt(92,98),"h1":pt(90,124),"e2":pt(110,98),"h2":pt(108,124)])),
    "lunge": ExerciseFigure(floor: true, period: 2400,
        top: Pose(j: ["head":pt(120,42),"neck":pt(120,60),"hip":pt(120,110),"k1":pt(114,135),"f1":pt(112,160),"k2":pt(126,135),"f2":pt(128,160),"e1":pt(114,76),"h1":pt(110,110),"e2":pt(126,76),"h2":pt(130,110)]),
        bottom: Pose(j: ["head":pt(106,52),"neck":pt(106,70),"hip":pt(106,116),"k1":pt(92,138),"f1":pt(88,160),"k2":pt(140,150),"f2":pt(160,158),"e1":pt(100,96),"h1":pt(98,120),"e2":pt(114,96),"h2":pt(112,120)])),
    "legcurl": ExerciseFigure(bench: (40,124,154), period: 2000,
        top: Pose(j: ["head":pt(56,114),"neck":pt(78,118),"hip":pt(150,120),"k1":pt(182,121),"f1":pt(206,123),"k2":pt(182,127),"f2":pt(206,129),"e1":pt(64,120),"h1":pt(44,121),"e2":pt(64,124),"h2":pt(44,125)]),
        bottom: Pose(j: ["head":pt(56,114),"neck":pt(78,118),"hip":pt(150,120),"k1":pt(182,121),"f1":pt(176,92),"k2":pt(182,127),"f2":pt(179,98),"e1":pt(64,120),"h1":pt(44,121),"e2":pt(64,124),"h2":pt(44,125)])),
    "thrust": ExerciseFigure(floor: true, bench: (34,96,66), period: 2200,
        top: Pose(j: ["head":pt(58,92),"neck":pt(78,98),"hip":pt(152,100),"k1":pt(166,126),"f1":pt(162,160),"k2":pt(178,126),"f2":pt(182,160),"e1":pt(70,104),"h1":pt(60,118),"e2":pt(86,104),"h2":pt(78,120)], bar: (pt(122,98),pt(182,100))),
        bottom: Pose(j: ["head":pt(58,92),"neck":pt(78,98),"hip":pt(150,140),"k1":pt(166,128),"f1":pt(162,160),"k2":pt(178,128),"f2":pt(182,160),"e1":pt(70,108),"h1":pt(60,124),"e2":pt(86,108),"h2":pt(78,128)], bar: (pt(120,138),pt(180,140)))),
    "pullup": ExerciseFigure(period: 2400,
        top: Pose(j: ["head":pt(120,58),"neck":pt(120,74),"hip":pt(120,122),"k1":pt(112,148),"f1":pt(110,170),"k2":pt(128,148),"f2":pt(130,170),"e1":pt(112,42),"h1":pt(100,24),"e2":pt(128,42),"h2":pt(140,24)], bar: (pt(55,22),pt(185,22))),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,52),"hip":pt(120,98),"k1":pt(114,124),"f1":pt(112,150),"k2":pt(127,124),"f2":pt(129,150),"e1":pt(103,40),"h1":pt(100,24),"e2":pt(137,40),"h2":pt(140,24)], bar: (pt(55,22),pt(185,22)))),
    "curl": ExerciseFigure(floor: true, period: 1900,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,90),"h1":pt(108,122),"e2":pt(128,90),"h2":pt(132,122)]),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,90),"h1":pt(104,66),"e2":pt(128,90),"h2":pt(136,66)])),
    "plank": ExerciseFigure(floor: true, period: 4200,
        top: Pose(j: ["head":pt(52,98),"neck":pt(70,102),"hip":pt(148,116),"k1":pt(176,128),"f1":pt(190,150),"k2":pt(182,130),"f2":pt(196,150),"e1":pt(68,118),"h1":pt(58,150),"e2":pt(74,118),"h2":pt(64,150)]),
        bottom: Pose(j: ["head":pt(52,100),"neck":pt(70,104),"hip":pt(148,120),"k1":pt(176,130),"f1":pt(190,150),"k2":pt(182,132),"f2":pt(196,150),"e1":pt(68,118),"h1":pt(58,150),"e2":pt(74,118),"h2":pt(64,150)])),
    "calf": ExerciseFigure(floor: true, period: 1700,
        top: Pose(j: ["head":pt(120,32),"neck":pt(120,48),"hip":pt(120,102),"k1":pt(112,140),"f1":pt(106,158),"k2":pt(128,140),"f2":pt(134,158),"e1":pt(112,68),"h1":pt(108,104),"e2":pt(128,68),"h2":pt(132,104)]),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,56),"hip":pt(120,110),"k1":pt(112,146),"f1":pt(100,162),"k2":pt(128,146),"f2":pt(140,162),"e1":pt(112,76),"h1":pt(108,112),"e2":pt(128,76),"h2":pt(132,112)])),
    "lateralraise": ExerciseFigure(floor: true, period: 2200,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,74),"h1":pt(108,108),"e2":pt(128,74),"h2":pt(132,108)]),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(106,64),"h1":pt(80,62),"e2":pt(134,64),"h2":pt(160,62)])),
    "dip": ExerciseFigure(floor: true, bench: (72,116,46), period: 2000,
        top: Pose(j: ["head":pt(122,68),"neck":pt(120,86),"hip":pt(116,120),"k1":pt(150,126),"f1":pt(150,158),"k2":pt(156,126),"f2":pt(156,158),"e1":pt(104,102),"h1":pt(94,116),"e2":pt(110,102),"h2":pt(100,116)]),
        bottom: Pose(j: ["head":pt(122,82),"neck":pt(120,100),"hip":pt(116,132),"k1":pt(150,126),"f1":pt(150,158),"k2":pt(156,126),"f2":pt(156,158),"e1":pt(100,108),"h1":pt(94,116),"e2":pt(106,108),"h2":pt(100,116)])),
    "legpress": ExerciseFigure(bench: (44,124,92), period: 2200,
        top: Pose(j: ["head":pt(56,112),"neck":pt(76,116),"hip":pt(120,120),"k1":pt(156,100),"f1":pt(190,86),"k2":pt(156,108),"f2":pt(190,94),"e1":pt(84,118),"h1":pt(68,126),"e2":pt(92,118),"h2":pt(76,126)]),
        bottom: Pose(j: ["head":pt(56,112),"neck":pt(76,116),"hip":pt(120,120),"k1":pt(140,108),"f1":pt(170,96),"k2":pt(140,116),"f2":pt(170,104),"e1":pt(84,118),"h1":pt(68,126),"e2":pt(92,118),"h2":pt(76,126)])),
    "facepull": ExerciseFigure(floor: true, period: 2000,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(116,72),"h1":pt(150,68),"e2":pt(124,72),"h2":pt(150,78)]),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(98,64),"h1":pt(110,56),"e2":pt(142,64),"h2":pt(130,56)])),
    "pushdown": ExerciseFigure(floor: true, period: 1800,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,92),"h1":pt(110,72),"e2":pt(128,92),"h2":pt(130,72)]),
        bottom: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,92),"h1":pt(111,116),"e2":pt(128,92),"h2":pt(129,116)])),
    "legraise": ExerciseFigure(period: 2400,
        top: Pose(j: ["head":pt(120,42),"neck":pt(120,58),"hip":pt(120,116),"k1":pt(116,142),"f1":pt(114,168),"k2":pt(126,142),"f2":pt(128,168),"e1":pt(112,52),"h1":pt(100,24),"e2":pt(128,52),"h2":pt(140,24)], bar: (pt(55,22),pt(185,22))),
        bottom: Pose(j: ["head":pt(120,42),"neck":pt(120,58),"hip":pt(120,116),"k1":pt(138,118),"f1":pt(164,114),"k2":pt(138,124),"f2":pt(164,120),"e1":pt(112,52),"h1":pt(100,24),"e2":pt(128,52),"h2":pt(140,24)], bar: (pt(55,22),pt(185,22)))),
    "stand": ExerciseFigure(floor: true, period: 4000,
        top: Pose(j: ["head":pt(120,40),"neck":pt(120,58),"hip":pt(120,112),"k1":pt(112,136),"f1":pt(110,160),"k2":pt(128,136),"f2":pt(130,160),"e1":pt(112,70),"h1":pt(106,108),"e2":pt(128,70),"h2":pt(134,108)]),
        bottom: Pose(j: ["head":pt(120,43),"neck":pt(120,61),"hip":pt(120,113),"k1":pt(112,137),"f1":pt(110,160),"k2":pt(128,137),"f2":pt(130,160),"e1":pt(112,72),"h1":pt(107,110),"e2":pt(128,72),"h2":pt(133,110)])),
    // Savasana — lying flat on the back along the floor, gentle breath.
    "savasana": ExerciseFigure(floor: true, period: 5000,
        top: Pose(j: ["head":pt(56,150),"neck":pt(80,150),"hip":pt(152,150),"k1":pt(176,149),"f1":pt(200,149),"k2":pt(176,153),"f2":pt(200,153),"e1":pt(96,152),"h1":pt(116,153),"e2":pt(96,148),"h2":pt(116,147)]),
        bottom: Pose(j: ["head":pt(56,150),"neck":pt(80,148),"hip":pt(152,148),"k1":pt(176,147),"f1":pt(200,147),"k2":pt(176,151),"f2":pt(200,151),"e1":pt(96,152),"h1":pt(116,153),"e2":pt(96,148),"h2":pt(116,147)])),
    // Child's pose — kneeling, folded forward, head low, arms reaching forward on the floor.
    "childpose": ExerciseFigure(floor: true, period: 4600,
        top: Pose(j: ["head":pt(76,150),"neck":pt(100,150),"hip":pt(132,146),"k1":pt(124,152),"f1":pt(144,158),"k2":pt(130,153),"f2":pt(150,159),"e1":pt(90,151),"h1":pt(62,155),"e2":pt(94,152),"h2":pt(66,156)]),
        bottom: Pose(j: ["head":pt(76,152),"neck":pt(100,151),"hip":pt(132,148),"k1":pt(124,152),"f1":pt(144,158),"k2":pt(130,153),"f2":pt(150,159),"e1":pt(90,152),"h1":pt(62,156),"e2":pt(94,153),"h2":pt(66,157)])),
    // Cat–cow — on hands and knees, arching (cow, head up) ↔ rounding (cat, head down).
    "catcow": ExerciseFigure(floor: true, period: 3600,
        top: Pose(j: ["head":pt(60,132),"neck":pt(82,140),"hip":pt(152,146),"k1":pt(156,150),"f1":pt(156,161),"k2":pt(162,150),"f2":pt(162,161),"e1":pt(78,150),"h1":pt(74,161),"e2":pt(86,150),"h2":pt(82,161)]),
        bottom: Pose(j: ["head":pt(64,152),"neck":pt(84,146),"hip":pt(152,138),"k1":pt(156,150),"f1":pt(156,161),"k2":pt(162,150),"f2":pt(162,161),"e1":pt(80,150),"h1":pt(74,161),"e2":pt(88,150),"h2":pt(82,161)])),
    // Supine twist — lying on the back, knees dropped to one side, arms opened out.
    "twistpose": ExerciseFigure(floor: true, period: 4200,
        top: Pose(j: ["head":pt(58,150),"neck":pt(82,150),"hip":pt(150,150),"k1":pt(168,140),"f1":pt(178,150),"k2":pt(172,138),"f2":pt(182,148),"e1":pt(100,146),"h1":pt(100,132),"e2":pt(110,150),"h2":pt(130,150)]),
        bottom: Pose(j: ["head":pt(58,150),"neck":pt(82,150),"hip":pt(150,150),"k1":pt(168,144),"f1":pt(178,152),"k2":pt(172,142),"f2":pt(182,150),"e1":pt(100,146),"h1":pt(100,132),"e2":pt(110,150),"h2":pt(130,150)])),
]

private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat { a + (b - a) * t }
private func lerpP(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint { CGPoint(x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)) }

struct StickFigureView: View {
    let type: String

    private let bone = Color(red: 0.173, green: 0.157, blue: 0.125)   // #2c2820
    private let gold = Color(red: 0.78, green: 0.72, blue: 0.60)      // #c8b89a
    private let boxW: CGFloat = 240, boxH: CGFloat = 175

    var body: some View {
        let fig = FIGURES[type] ?? FIGURES["stand"]!
        TimelineView(.animation) { timeline in
            Canvas { ctx, size in
                let scale = min(size.width / boxW, size.height / boxH)
                let ox = (size.width - boxW * scale) / 2
                let oy = (size.height - boxH * scale) / 2
                func P(_ p: CGPoint) -> CGPoint { CGPoint(x: ox + p.x * scale, y: oy + p.y * scale) }

                // eased ping-pong 0→1→0 over the period
                let period = fig.period / 1000
                let secs = timeline.date.timeIntervalSinceReferenceDate
                let phase = (secs.truncatingRemainder(dividingBy: period)) / period
                let tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2
                let t = CGFloat(0.5 - 0.5 * cos(tri * .pi))

                var j: [String: CGPoint] = [:]
                for k in ["head","neck","hip","k1","f1","k2","f2","e1","h1","e2","h2"] {
                    if let a = fig.top.j[k], let b = fig.bottom.j[k] { j[k] = lerpP(a, b, t) }
                }
                let bar: (CGPoint, CGPoint)? = {
                    if let a = fig.top.bar, let b = fig.bottom.bar {
                        return (lerpP(a.0, b.0, t), lerpP(a.1, b.1, t))
                    }
                    return nil
                }()

                func line(_ a: CGPoint?, _ b: CGPoint?, _ w: CGFloat, _ c: Color) {
                    guard let a, let b else { return }
                    var path = Path(); path.move(to: P(a)); path.addLine(to: P(b))
                    ctx.stroke(path, with: .color(c), style: StrokeStyle(lineWidth: w * scale, lineCap: .round))
                }
                func dot(_ p: CGPoint?, _ r: CGFloat, _ c: Color) {
                    guard let p else { return }
                    let pp = P(p)
                    ctx.fill(Path(ellipseIn: CGRect(x: pp.x - r*scale, y: pp.y - r*scale, width: 2*r*scale, height: 2*r*scale)), with: .color(c))
                }

                // floor + bench + bar
                if fig.floor { line(pt(30,162), pt(210,162), 3, gold) }
                if let bench = fig.bench {
                    let rect = CGRect(x: ox + bench.0*scale, y: oy + bench.1*scale, width: bench.2*scale, height: 11*scale)
                    ctx.fill(Path(roundedRect: rect, cornerRadius: 5*scale), with: .color(Color(red: 0.925, green: 0.886, blue: 0.816)))
                    ctx.stroke(Path(roundedRect: rect, cornerRadius: 5*scale), with: .color(gold), lineWidth: 2*scale)
                }
                if let bar { line(bar.0, bar.1, 5, gold) }

                // bones
                let headBottom = j["head"].map { CGPoint(x: $0.x, y: $0.y + 14) }
                line(headBottom, j["neck"], 3, bone)
                line(j["neck"], j["hip"], 3, bone)
                line(j["hip"], j["k1"], 3, bone); line(j["k1"], j["f1"], 3, bone)
                line(j["hip"], j["k2"], 3, bone); line(j["k2"], j["f2"], 3, bone)
                line(j["neck"], j["e1"], 2.5, bone); line(j["e1"], j["h1"], 2.5, bone)
                line(j["neck"], j["e2"], 2.5, bone); line(j["e2"], j["h2"], 2.5, bone)

                // joint dots + bar plates
                dot(j["neck"], 3, gold); dot(j["hip"], 3.4, gold)
                dot(j["k1"], 3.4, gold); dot(j["k2"], 3.4, gold)
                dot(j["e1"], 3, gold); dot(j["e2"], 3, gold)
                if let bar { dot(bar.0, 4, gold); dot(bar.1, 4, gold) }

                // head (white fill + outline)
                if let h = j["head"] {
                    let hp = P(h); let r = 14 * scale
                    let rect = CGRect(x: hp.x - r, y: hp.y - r, width: 2*r, height: 2*r)
                    ctx.fill(Path(ellipseIn: rect), with: .color(.white))
                    ctx.stroke(Path(ellipseIn: rect), with: .color(bone), lineWidth: 3*scale)
                }
            }
        }
        .aspectRatio(boxW / boxH, contentMode: .fit)
    }
}

#Preview {
    VStack {
        StickFigureView(type: "squat").frame(height: 90)
        StickFigureView(type: "hinge").frame(height: 90)
    }
}
