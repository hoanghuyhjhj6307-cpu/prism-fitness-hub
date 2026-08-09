import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, CalendarCheck, Dumbbell, Users, User, ChevronRight, ChevronLeft,
  ChevronUp, ChevronDown, Flame, Trophy, Star, Plus, Check, X, Pencil, Copy, Trash2,
  Play, Camera, TrendingUp, Clock, Target, GripVertical, Menu, ShieldCheck,
  LogOut, ArrowLeft, BarChart3, Calendar, Search, Sparkles, Zap, Download,
  Loader2, Save, RefreshCw, UserCheck, UserX, ListChecks,
  Activity, Minus, UtensilsCrossed, Footprints, Scale, Info, Wheat, Droplet
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "./supabaseClient";

/* =========================================================================
   KBL — private fitness hub
   React app backed by Supabase (Postgres + Auth). Shared state (members,
   programs, history) lives in one JSONB row; each user's photos live in
   their own row. Auth is Google OAuth via Supabase Auth.
   ========================================================================= */

/* ---------------------------- Design tokens ---------------------------- */
const GRAD = "grad-brand";
const GRAD_DIAG = "grad-brand-diag";
const GRAD_TEXT = "grad-brand-text";
const GRAD_WARM = "grad-warm";

const AVATAR_SWATCHES = [
  "from-rose-500 to-pink-600",
  "from-pink-500 to-fuchsia-600",
  "from-orange-500 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-lime-400 to-green-500",
  "from-teal-400 to-emerald-500",
  "from-sky-500 to-cyan-400",
  "from-indigo-500 to-sky-500",
  "from-purple-500 to-indigo-600",
  "from-fuchsia-500 to-purple-600",
];

/* ------------------------------ Constants ------------------------------- */
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const DAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const DAY_FROM_JS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // Date.getDay() index

const GOALS = [
  { id: "muscle", label: "Build Muscle", icon: "💪" },
  { id: "fat", label: "Lose Fat", icon: "🔥" },
  { id: "strength", label: "Strength", icon: "🏋️" },
  { id: "hybrid", label: "Hybrid Athlete", icon: "⚡" },
  { id: "running", label: "Running", icon: "🏃" },
];
// Goals can be one of the presets above, or free text the user typed in themselves
// (GoalPicker stores that raw text as the id). This resolves either case to a
// consistent { id, icon, label } shape so callers never have to special-case it.
function goalInfo(goal) {
  return GOALS.find((g) => g.id === goal) || (goal ? { id: goal, icon: "🎯", label: goal } : GOALS[3]);
}

// loadType controls how "weight" is captured for an exercise:
//   "external"   — the lifter moves an added load (barbell/dumbbell/machine/cable/kettlebell).
//                   The number entered IS the weight lifted.
//   "bodyweight" — the lifter's own mass is the primary load (push-up, pull-up, squat…).
//                   See computeBodyweightLoad() below for how total load is estimated.
//   "cardio"     — duration/effort based; no meaningful "weight" to log.
const MUSCLE_CATEGORIES = ["Chest", "Back", "Legs", "Glutes", "Shoulders", "Arms", "Core", "Cardio", "Full Body"];
// Major muscle groups — the big, primary movers an exercise is actually built around.
// This is deliberately a short list; Cardio/Full Body are excluded since they're workout
// types, not muscles (Cardio is captured by the "How is it loaded?" selector instead).
const MAIN_MUSCLE_OPTIONS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Abs", "Glutes", "Quads", "Hamstrings", "Calves"];
// Smaller/stabilizer muscles and subdivisions of the major groups above — these only ever
// show up as "also works" targets, never as the main muscle group of an exercise.
const MINOR_MUSCLE_OPTIONS = ["Upper Back", "Lats", "Traps", "Lower Back", "Front Delts", "Side Delts", "Rear Delts", "Obliques", "Adductors", "Abductors", "Grip"];
// Maps each major muscle group back to one of the broad MUSCLE_CATEGORIES so a custom
// exercise still shows up under the right tab in the exercise browser.
const MUSCLE_TO_CATEGORY = {
  "Chest": "Chest",
  "Back": "Back",
  "Shoulders": "Shoulders",
  "Biceps": "Arms", "Triceps": "Arms", "Forearms": "Arms",
  "Abs": "Core",
  "Glutes": "Glutes",
  "Quads": "Legs", "Hamstrings": "Legs", "Calves": "Legs",
};

const EXERCISE_LIBRARY = [
  // ---------------------------------- Chest ----------------------------------
  { id: "ex_bench", name: "Barbell Bench Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Lie flat, grip the bar slightly wider than shoulder-width. Lower with control to mid-chest, then press up to full extension." },
  { id: "ex_incline_bench", name: "Incline Barbell Press", muscle: "Chest", secondary: ["Front Delts", "Triceps"], icon: "🏋️", loadType: "external", instructions: "On a 30-45° incline bench, lower the bar to the upper chest, then press up to full extension." },
  { id: "ex_decline_bench", name: "Decline Barbell Press", muscle: "Chest", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "On a decline bench, lower the bar to the lower chest, then press up to full extension." },
  { id: "ex_incline_db", name: "Incline Dumbbell Press", muscle: "Chest", secondary: ["Front Delts", "Triceps"], icon: "🏋️", loadType: "external", instructions: "On a 30-45° incline bench, press dumbbells up over the upper chest, then lower slowly until a stretch is felt." },
  { id: "ex_flat_db_press", name: "Flat Dumbbell Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Lying flat, press dumbbells up over the chest until arms are extended, then lower with control." },
  { id: "ex_decline_db_press", name: "Decline Dumbbell Press", muscle: "Chest", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "On a decline bench, press dumbbells up over the lower chest until arms extend, then lower under control." },
  { id: "ex_db_flye", name: "Dumbbell Flye", muscle: "Chest", secondary: ["Front Delts"], icon: "🏋️", loadType: "external", instructions: "Lying flat with a slight elbow bend, lower the dumbbells out to the sides in an arc, then bring them back together over the chest." },
  { id: "ex_cable_crossover", name: "Cable Crossover", muscle: "Chest", secondary: ["Front Delts"], icon: "🏋️", loadType: "external", instructions: "Standing between two cable stacks, pull the handles down and together in front of the chest, squeezing at the finish." },
  { id: "ex_low_cable_flye", name: "Low-to-High Cable Flye", muscle: "Chest", secondary: ["Front Delts"], icon: "🏋️", loadType: "external", instructions: "Cables set low, sweep the handles up and across the body in an arc to chest height, squeezing at the top." },
  { id: "ex_high_cable_flye", name: "High-to-Low Cable Flye", muscle: "Chest", secondary: [], icon: "🏋️", loadType: "external", instructions: "Cables set high, sweep the handles down and across the body in an arc, squeezing the lower chest at the finish." },
  { id: "ex_machine_press", name: "Machine Chest Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Sit tall, press the handles forward until arms are extended, then return under control." },
  { id: "ex_smith_bench", name: "Smith Machine Bench Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Lying on the bench under a fixed-path bar, lower to mid-chest and press back up along the guided track." },
  { id: "ex_pec_deck", name: "Pec Deck", muscle: "Chest", secondary: [], icon: "🏋️", loadType: "external", instructions: "Sit with elbows at shoulder height, bring the pads together in front of the chest, then return slowly." },
  { id: "ex_landmine_press", name: "Landmine Press", muscle: "Chest", secondary: ["Front Delts", "Triceps", "Core"], icon: "🏋️", loadType: "external", instructions: "One end of the bar anchored, press the free end up and slightly forward from the shoulder, then lower under control." },
  { id: "ex_dumbbell_pullover", name: "Dumbbell Pullover", muscle: "Chest", secondary: ["Back", "Core"], icon: "🏋️", loadType: "external", instructions: "Lying across a bench, lower a single dumbbell in an arc behind the head, then pull it back over the chest." },
  { id: "ex_pushup", name: "Push-Up", muscle: "Chest", secondary: ["Triceps", "Core", "Front Delts"], icon: "🤸", loadType: "bodyweight", bwPercent: 64, instructions: "Hands under shoulders, body in a straight line. Lower chest to the floor, then press back up." },
  { id: "ex_incline_pushup", name: "Incline Push-Up", muscle: "Chest", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 55, instructions: "Hands elevated on a bench or box, lower the chest toward it, then press back up. Easier than a standard push-up." },
  { id: "ex_decline_pushup", name: "Decline Push-Up", muscle: "Chest", secondary: ["Triceps", "Front Delts", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 74, instructions: "Feet elevated on a bench, hands on the floor. Lower the chest down, then press back up. Harder than a standard push-up." },
  { id: "ex_diamond_pushup", name: "Diamond Push-Up", muscle: "Chest", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 68, instructions: "Hands together under the chest forming a diamond shape. Lower and press back up, emphasizing triceps and inner chest." },
  { id: "ex_chest_dip", name: "Chest Dip", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "On parallel bars, lean the torso forward and lower until a stretch is felt in the chest, then press back up." },
  { id: "ex_machine_incline_press", name: "Machine Incline Press", muscle: "Chest", secondary: ["Front Delts", "Triceps"], icon: "🏋️", loadType: "external", instructions: "Sit on an incline angle, press the handles up and forward until arms extend, then return under control." },
  { id: "ex_standing_cable_press", name: "Standing Cable Chest Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Standing in a staggered stance, press the handles forward from chest height until arms extend, then return under control." },
  { id: "ex_guillotine_press", name: "Guillotine Press", muscle: "Chest", secondary: ["Front Delts", "Triceps"], icon: "🏋️", loadType: "external", instructions: "Lying flat, lower the bar to the neck/upper chest with elbows flared, then press back up — an advanced high-chest variation." },
  { id: "ex_hex_press", name: "Hex Press", muscle: "Chest", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Lying flat, press two dumbbells together throughout the movement, squeezing the inner chest at the top." },
  { id: "ex_svend_press", name: "Svend Press", muscle: "Chest", secondary: ["Front Delts"], icon: "🏋️", loadType: "external", instructions: "Press two plates together in front of the chest, squeezing tightly, then extend the arms straight out and pull back in." },
  { id: "ex_band_chest_press", name: "Resistance Band Chest Press", muscle: "Chest", secondary: ["Triceps", "Front Delts"], icon: "🏋️", loadType: "external", instructions: "Anchored behind you, press the handles forward against band tension until arms extend, then control the return." },
  { id: "ex_plyo_pushup", name: "Plyometric Push-Up", muscle: "Chest", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 90, instructions: "Explode up from the bottom of a push-up so the hands leave the floor, then land softly and reset." },
  { id: "ex_archer_pushup", name: "Archer Push-Up", muscle: "Chest", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 90, instructions: "Wide hand position, shift the weight to one side lowering that shoulder while the other arm stays extended, then push back up and alternate." },
  { id: "ex_weighted_pushup", name: "Weighted Push-Up", muscle: "Chest", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 70, instructions: "With a plate or vest adding load on the back, lower the chest to the floor, then press back up." },

  // ----------------------------------- Back -----------------------------------
  { id: "ex_deadlift", name: "Conventional Deadlift", muscle: "Back", secondary: ["Glutes", "Hamstrings", "Core"], icon: "🏋️", loadType: "external", instructions: "Hips back, flat spine, grip just outside the legs. Drive through the floor and stand tall, hips and shoulders rising together." },
  { id: "ex_sumo_deadlift", name: "Sumo Deadlift", muscle: "Back", secondary: ["Glutes", "Legs", "Core"], icon: "🏋️", loadType: "external", instructions: "Wide stance, grip inside the knees. Drive through the floor keeping the chest tall, standing to full hip extension." },
  { id: "ex_deficit_deadlift", name: "Deficit Deadlift", muscle: "Back", secondary: ["Glutes", "Hamstrings", "Core"], icon: "🏋️", loadType: "external", instructions: "Standing on a small platform for extra range, pull the bar from the floor to full lockout, keeping the spine flat." },
  { id: "ex_rdl", name: "Romanian Deadlift", muscle: "Back", secondary: ["Hamstrings", "Glutes"], icon: "🏋️", loadType: "external", instructions: "Soft knees, hinge at the hips lowering the bar along the legs, then drive the hips forward to stand tall." },
  { id: "ex_row", name: "Barbell Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Hinge at the hips, flat back. Pull the bar to the lower ribs, squeezing the shoulder blades together." },
  { id: "ex_pendlay_row", name: "Pendlay Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Torso near-parallel to the floor, bar starts on the ground each rep. Explosively pull it to the lower chest, then reset." },
  { id: "ex_tbar_row", name: "T-Bar Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Chest against the pad or hinged over the bar, pull the handles to the torso, squeezing the back at the top." },
  { id: "ex_meadows_row", name: "Meadows Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "One end of a landmine bar, hinge over and row it to the hip with a single arm, squeezing the back at the top." },
  { id: "ex_chest_supported_row", name: "Chest-Supported Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Chest braced against an incline pad, row the handles to the torso, squeezing the shoulder blades together." },
  { id: "ex_seated_row", name: "Seated Cable Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Sit tall, pull the handle to the torso keeping the back straight, then extend arms fully on the return." },
  { id: "ex_db_row", name: "Single-Arm Dumbbell Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "One hand and knee braced on a bench, pull the dumbbell to the hip, then lower under control." },
  { id: "ex_latpull", name: "Lat Pulldown", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🧗", loadType: "external", instructions: "Grip the bar wide, pull down to the upper chest while keeping the torso tall, then control the return." },
  { id: "ex_close_grip_pulldown", name: "Close-Grip Lat Pulldown", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "external", instructions: "Using a close, neutral handle, pull down to the upper chest keeping elbows tucked, then control the return." },
  { id: "ex_straight_arm_pulldown", name: "Straight-Arm Pulldown", muscle: "Back", secondary: ["Triceps", "Core"], icon: "🧗", loadType: "external", instructions: "Arms straight, sweep the bar down from overhead to the thighs, keeping a slight elbow bend throughout." },
  { id: "ex_rack_pull", name: "Rack Pull", muscle: "Back", secondary: ["Glutes", "Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Bar set at knee height in a rack. Drive through the floor and lock out the hips at the top." },
  { id: "ex_good_morning", name: "Good Morning", muscle: "Back", secondary: ["Hamstrings", "Glutes"], icon: "🏋️", loadType: "external", instructions: "Bar on the upper back, hinge forward at the hips with a soft knee bend, then return to standing." },
  { id: "ex_shrug", name: "Barbell Shrug", muscle: "Back", secondary: ["Traps"], icon: "🏋️", loadType: "external", instructions: "Holding the bar in front of the thighs, elevate the shoulders straight up toward the ears, then lower slowly." },
  { id: "ex_db_shrug", name: "Dumbbell Shrug", muscle: "Back", secondary: ["Traps"], icon: "🏋️", loadType: "external", instructions: "Holding dumbbells at the sides, elevate the shoulders straight up toward the ears, then lower slowly." },
  { id: "ex_hyperextension", name: "Back Extension", muscle: "Back", secondary: ["Glutes", "Hamstrings"], icon: "🏋️", loadType: "bodyweight", bwPercent: 55, instructions: "Hips hinged over the pad, lower the torso down with control, then raise back up to a flat line using the glutes and back." },
  { id: "ex_pullup", name: "Pull-Up", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "bodyweight", bwPercent: 100, instructions: "Hang from the bar with an overhand grip, pull the chest toward it until the chin clears, then lower under control." },
  { id: "ex_chinup", name: "Chin-Up", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "bodyweight", bwPercent: 100, instructions: "Hang from the bar with an underhand grip, pull the chest toward it until the chin clears, then lower under control." },
  { id: "ex_inverted_row", name: "Inverted Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🧗", loadType: "bodyweight", bwPercent: 65, instructions: "Under a bar or rings, body straight, pull the chest up to the bar, then lower with control." },
  { id: "ex_muscle_up", name: "Muscle-Up", muscle: "Back", secondary: ["Biceps", "Triceps", "Chest"], icon: "🧗", loadType: "bodyweight", bwPercent: 100, instructions: "Pull explosively from a hang to clear the bar with the chest, then transition and press up to full lockout above it." },
  { id: "ex_wide_pullup", name: "Wide-Grip Pull-Up", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "bodyweight", bwPercent: 100, instructions: "Hands wide on the bar, pull the chest up focusing on the lats, then lower under control." },
  { id: "ex_weighted_pullup", name: "Weighted Pull-Up", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "bodyweight", bwPercent: 100, instructions: "Add load via a belt or vest, pull the chest to the bar, then lower under control for a harder pull-up variation." },
  { id: "ex_assisted_pullup", name: "Assisted Pull-Up (Machine)", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "bodyweight", bwPercent: 60, instructions: "Using the assistance platform or band, pull the chest to the bar with reduced bodyweight load, then lower under control." },
  { id: "ex_renegade_row", name: "Renegade Row", muscle: "Back", secondary: ["Core", "Triceps"], icon: "🚣", loadType: "external", instructions: "In a plank on dumbbells, row one dumbbell to the hip while stabilizing with the other arm, then alternate sides." },
  { id: "ex_kroc_row", name: "Kroc Row", muscle: "Back", secondary: ["Biceps", "Traps"], icon: "🚣", loadType: "external", instructions: "Using a heavy dumbbell and some body english, row explosively to the hip, then lower with control." },
  { id: "ex_seal_row", name: "Seal Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "Lying face-down on a raised bench, row the bar straight up to the chest without any body swing, then lower." },
  { id: "ex_landmine_row", name: "Landmine Row", muscle: "Back", secondary: ["Biceps", "Rear Delts"], icon: "🚣", loadType: "external", instructions: "One end of a landmine bar, hinge over and row it to the torso with both hands, then lower under control." },
  { id: "ex_reverse_pulldown", name: "Reverse-Grip Lat Pulldown", muscle: "Back", secondary: ["Biceps"], icon: "🧗", loadType: "external", instructions: "Underhand grip, pull the bar down to the upper chest emphasizing the lower lats, then control the return." },
  { id: "ex_cable_pullover", name: "Cable Pullover", muscle: "Back", secondary: ["Chest", "Triceps"], icon: "🧗", loadType: "external", instructions: "Standing with a straight bar on a high cable, sweep the arms down in an arc to the thighs, then return under control." },
  { id: "ex_superman", name: "Superman", muscle: "Back", secondary: ["Glutes"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Lying face down, simultaneously raise the arms, chest, and legs off the floor, hold briefly, then lower." },

  // ----------------------------------- Legs -----------------------------------
  { id: "ex_squat", name: "Back Squat", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🦵", loadType: "external", instructions: "Bar on upper back, feet shoulder-width. Bend hips and knees until thighs are at least parallel, then drive up." },
  { id: "ex_frontsquat", name: "Front Squat", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🦵", loadType: "external", instructions: "Bar racked across the front shoulders, elbows high. Squat down keeping the torso upright, then stand tall." },
  { id: "ex_sumo_squat", name: "Sumo Squat", muscle: "Legs", secondary: ["Glutes", "Adductors"], icon: "🦵", loadType: "external", instructions: "Wide stance, toes turned out, holding a dumbbell or bar. Squat down between the legs, then drive back up." },
  { id: "ex_goblet_squat", name: "Goblet Squat", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🦵", loadType: "external", instructions: "Holding a dumbbell at the chest, squat down keeping the torso upright, then drive back up through the heels." },
  { id: "ex_zercher_squat", name: "Zercher Squat", muscle: "Legs", secondary: ["Glutes", "Core", "Back"], icon: "🦵", loadType: "external", instructions: "Bar cradled in the crooks of the elbows, squat down keeping the torso upright, then stand tall." },
  { id: "ex_hacksquat", name: "Hack Squat", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Back against the pad on a hack squat machine, lower under control until knees reach ~90°, then press up." },
  { id: "ex_legpress", name: "Leg Press", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Feet shoulder-width on the platform. Lower until knees reach ~90°, then press through the heels." },
  { id: "ex_legext", name: "Leg Extension", muscle: "Legs", secondary: [], icon: "🦵", loadType: "external", instructions: "Seated, extend the knees to lift the pad until legs are straight, then lower slowly." },
  { id: "ex_legcurl", name: "Leg Curl", muscle: "Legs", secondary: ["Hamstrings"], icon: "🦵", loadType: "external", instructions: "Lying or seated, curl the pad toward the glutes by flexing the knees, then lower under control." },
  { id: "ex_stiff_leg_deadlift", name: "Stiff-Leg Deadlift", muscle: "Legs", secondary: ["Hamstrings", "Glutes", "Back"], icon: "🦵", loadType: "external", instructions: "With mostly straight legs, hinge at the hips lowering the bar along the shins, then drive the hips forward to stand." },
  { id: "ex_bulgarian", name: "Bulgarian Split Squat", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Rear foot elevated on a bench, holding dumbbells. Lower the back knee toward the floor, then drive up through the front foot." },
  { id: "ex_lunge_db", name: "Walking Lunge (Weighted)", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Holding dumbbells, step forward and lower the back knee toward the floor, then drive up and repeat on the other leg." },
  { id: "ex_step_up", name: "Weighted Step-Up", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Holding dumbbells, step fully onto a box driving through the lead heel, then step down with control." },
  { id: "ex_calf_raise", name: "Calf Raise (Machine)", muscle: "Legs", secondary: ["Calves"], icon: "🦵", loadType: "external", instructions: "Balls of the feet on the platform, rise onto the toes as high as possible, then lower until a stretch is felt." },
  { id: "ex_seated_calf_raise", name: "Seated Calf Raise", muscle: "Legs", secondary: ["Calves"], icon: "🦵", loadType: "external", instructions: "Balls of the feet on the platform, knees bent under the pad, rise onto the toes, then lower to a full stretch." },
  { id: "ex_adductor_machine", name: "Hip Adductor Machine", muscle: "Legs", secondary: ["Adductors"], icon: "🦵", loadType: "external", instructions: "Seated with the pads on the inner thighs, squeeze the legs together, then return under control." },
  { id: "ex_abductor_machine", name: "Hip Abductor Machine", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Seated with the pads on the outer thighs, push the legs apart, then return under control." },
  { id: "ex_glute_ham_raise", name: "Glute-Ham Raise", muscle: "Legs", secondary: ["Hamstrings", "Glutes"], icon: "🦵", loadType: "bodyweight", bwPercent: 100, instructions: "Anchored at the ankles, lower the torso forward under control using the hamstrings, then curl back up to vertical." },
  { id: "ex_nordic_curl", name: "Nordic Hamstring Curl", muscle: "Legs", secondary: ["Hamstrings"], icon: "🦵", loadType: "bodyweight", bwPercent: 100, instructions: "Kneeling with ankles anchored, lower the torso forward as slowly as possible, then use the hamstrings to pull back up." },
  { id: "ex_sissy_squat", name: "Sissy Squat", muscle: "Legs", secondary: ["Core"], icon: "🦵", loadType: "bodyweight", bwPercent: 100, instructions: "Rising onto the toes, lean back and bend the knees forward, lowering the torso in a straight line, then return up." },
  { id: "ex_bw_squat", name: "Bodyweight Squat", muscle: "Legs", secondary: ["Glutes"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Feet shoulder-width. Bend hips and knees until thighs are at least parallel, then drive back up." },
  { id: "ex_bw_lunge", name: "Walking Lunge", muscle: "Legs", secondary: ["Glutes"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Step forward, lower the back knee toward the floor, then drive up and repeat on the other leg." },
  { id: "ex_pistol_squat", name: "Pistol Squat", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Balance on one leg, lower into a full squat while the other leg stays extended forward, then drive back up." },
  { id: "ex_jump_squat", name: "Jump Squat", muscle: "Legs", secondary: ["Glutes", "Calves"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Squat down, then explode upward into a jump, landing softly and resetting for the next rep." },
  { id: "ex_box_jump", name: "Box Jump", muscle: "Legs", secondary: ["Glutes", "Calves"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Swing the arms and jump explosively onto a box, landing softly with bent knees, then step back down." },
  { id: "ex_wall_sit", name: "Wall Sit", muscle: "Legs", secondary: [], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Back flat against a wall, thighs parallel to the floor, hold the position for time." },
  { id: "ex_bw_calf_raise", name: "Bodyweight Calf Raise", muscle: "Legs", secondary: ["Calves"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Standing, rise onto the toes as high as possible, then lower until a stretch is felt in the calves." },
  { id: "ex_smith_squat", name: "Smith Machine Squat", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Feet slightly forward of the bar on a fixed track, squat down until thighs are at least parallel, then press up." },
  { id: "ex_box_squat", name: "Box Squat", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Squat down to lightly touch a box behind you, then drive back up without relaxing at the bottom." },
  { id: "ex_pause_squat", name: "Pause Squat", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🦵", loadType: "external", instructions: "Squat down and hold at the bottom for a count before driving back up, building strength out of the hole." },
  { id: "ex_reverse_lunge_db", name: "Reverse Lunge (Weighted)", muscle: "Legs", secondary: ["Glutes"], icon: "🦵", loadType: "external", instructions: "Holding dumbbells, step backward and lower the back knee toward the floor, then drive up through the front foot." },
  { id: "ex_lateral_lunge", name: "Lateral Lunge", muscle: "Legs", secondary: ["Glutes", "Adductors"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Step wide to one side, sit the hips back and bend that knee while the other leg stays straight, then push back to center." },
  { id: "ex_cossack_squat", name: "Cossack Squat", muscle: "Legs", secondary: ["Glutes", "Adductors"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Wide stance, shift the weight to one side sinking into a deep squat on that leg while the other stays straight, then switch sides." },
  { id: "ex_sled_push", name: "Sled Push", muscle: "Legs", secondary: ["Glutes", "Core"], icon: "🦵", loadType: "external", instructions: "Drive the sled forward with powerful, controlled strides, keeping the torso low and braced." },
  { id: "ex_sled_pull", name: "Sled Pull (Backward Drag)", muscle: "Legs", secondary: ["Glutes", "Quads"], icon: "🦵", loadType: "external", instructions: "Facing the sled, walk backward pulling it toward you with steady tension through the straps." },
  { id: "ex_standing_calf_raise", name: "Standing Barbell Calf Raise", muscle: "Legs", secondary: ["Calves"], icon: "🦵", loadType: "external", instructions: "Bar on the upper back, rise onto the toes as high as possible, then lower to a full stretch." },
  { id: "ex_donkey_calf_raise", name: "Donkey Calf Raise", muscle: "Legs", secondary: ["Calves"], icon: "🦵", loadType: "external", instructions: "Hinged forward at the hips with weight loaded on the hips, rise onto the toes, then lower to a full stretch." },
  { id: "ex_tibialis_raise", name: "Tibialis Raise", muscle: "Legs", secondary: [], icon: "🤸", loadType: "bodyweight", bwPercent: 30, instructions: "Leaning back against a wall, raise the toes up toward the shins repeatedly to build the tibialis muscle." },

  // ---------------------------------- Glutes -----------------------------------
  { id: "ex_hip_thrust", name: "Barbell Hip Thrust", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Upper back on a bench, bar over the hips. Drive through the heels to lock out the hips, then lower under control." },
  { id: "ex_single_leg_hip_thrust", name: "Single-Leg Hip Thrust", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Upper back on a bench, one foot planted and the other extended. Drive the hips up through the planted heel, then lower." },
  { id: "ex_cable_kickback", name: "Cable Glute Kickback", muscle: "Glutes", secondary: [], icon: "🏋️", loadType: "external", instructions: "Ankle cuff attached to the cable, kick the leg back and up while keeping the core braced, then return slowly." },
  { id: "ex_cable_pull_through", name: "Cable Pull-Through", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Facing away from the low cable, hinge at the hips letting the rope pull back, then drive the hips forward to stand." },
  { id: "ex_glute_bridge", name: "Glute Bridge", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, knees bent, drive the hips up by squeezing the glutes, then lower under control." },
  { id: "ex_single_glute_bridge", name: "Single-Leg Glute Bridge", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "One foot on the floor, drive the hips up while the other leg stays extended, then lower with control." },
  { id: "ex_frog_pump", name: "Frog Pump", muscle: "Glutes", secondary: [], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, soles of the feet together and knees dropped open, pulse the hips up squeezing the glutes." },
  { id: "ex_donkey_kick", name: "Donkey Kick", muscle: "Glutes", secondary: [], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "On hands and knees, kick one leg up and back keeping the knee bent, squeezing the glute at the top." },
  { id: "ex_curtsy_lunge", name: "Curtsy Lunge", muscle: "Glutes", secondary: ["Legs"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Step one leg diagonally behind the other into a curtsy position, lower the back knee, then drive back up." },
  { id: "ex_fire_hydrant", name: "Fire Hydrant", muscle: "Glutes", secondary: [], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "On hands and knees, lift one bent knee out to the side keeping the hips square, then lower with control." },
  { id: "ex_cable_hip_thrust", name: "Cable Hip Thrust", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Low cable attached at the hips, drive the hips forward against the resistance, then return under control." },
  { id: "ex_banded_hip_thrust", name: "Banded Hip Thrust", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Band looped over the hips and anchored, drive the hips up against the band tension, then lower." },
  { id: "ex_bstance_hip_thrust", name: "B-Stance Hip Thrust", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "One foot slightly forward for balance, drive through the rear heel to extend the hips, emphasizing one side." },
  { id: "ex_reverse_hyper", name: "Reverse Hyperextension", muscle: "Glutes", secondary: ["Hamstrings", "Lower Back"], icon: "🏋️", loadType: "external", instructions: "Hips on the pad, swing the legs up behind you using the glutes and hamstrings, then lower with control." },
  { id: "ex_clamshell", name: "Clamshell", muscle: "Glutes", secondary: ["Abductors"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the side with knees bent, open the top knee like a clamshell while keeping the feet together, then lower." },
  { id: "ex_banded_lateral_walk", name: "Banded Lateral Walk", muscle: "Glutes", secondary: ["Abductors"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Band around the ankles or knees, take small side steps keeping tension on the band throughout." },
  { id: "ex_weighted_glute_bridge", name: "Weighted Glute Bridge", muscle: "Glutes", secondary: ["Hamstrings"], icon: "🏋️", loadType: "external", instructions: "Lying on the back with a barbell or plate over the hips, drive the hips up, then lower under control." },

  // --------------------------------- Shoulders ---------------------------------
  { id: "ex_ohp", name: "Overhead Press", muscle: "Shoulders", secondary: ["Triceps", "Core"], icon: "🏋️", loadType: "external", instructions: "Bar at the shoulders, brace the core, press straight overhead until arms lock out." },
  { id: "ex_push_press", name: "Push Press", muscle: "Shoulders", secondary: ["Triceps", "Legs", "Core"], icon: "🏋️", loadType: "external", instructions: "Bar at the shoulders, dip the knees slightly then drive up explosively, pressing the bar overhead to lockout." },
  { id: "ex_arnold_press", name: "Arnold Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Start with palms facing you, press the dumbbells overhead while rotating the palms to face forward." },
  { id: "ex_seated_db_press", name: "Seated Dumbbell Shoulder Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Seated with back support, press the dumbbells straight overhead until arms extend, then lower under control." },
  { id: "ex_machine_shoulder_press", name: "Machine Shoulder Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Sit tall, press the handles straight overhead until arms extend, then return under control." },
  { id: "ex_landmine_lateral", name: "Landmine Lateral Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Holding the end of a landmine bar with one arm, raise it out to the side to shoulder height, then lower slowly." },
  { id: "ex_latraise", name: "Lateral Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Raise dumbbells out to the sides to shoulder height with a slight elbow bend, then lower slowly." },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Cable set low at the side, raise the handle out and up to shoulder height, then lower under control." },
  { id: "ex_front_raise", name: "Front Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Raise a dumbbell or plate straight in front to shoulder height, then lower with control." },
  { id: "ex_rear_delt_flye", name: "Rear Delt Flye", muscle: "Shoulders", secondary: ["Back"], icon: "🙆", loadType: "external", instructions: "Hinged forward, raise the dumbbells out to the sides squeezing the rear shoulders, then lower slowly." },
  { id: "ex_reverse_pec_deck", name: "Reverse Pec Deck", muscle: "Shoulders", secondary: ["Back"], icon: "🙆", loadType: "external", instructions: "Chest against the pad, sweep the handles out and back squeezing the rear delts, then return under control." },
  { id: "ex_upright_row", name: "Upright Row", muscle: "Shoulders", secondary: ["Traps"], icon: "🙆", loadType: "external", instructions: "Pull the bar straight up along the body to chest height, leading with the elbows, then lower under control." },
  { id: "ex_facepull", name: "Face Pull", muscle: "Shoulders", secondary: ["Back", "Traps"], icon: "🙆", loadType: "external", instructions: "Pull the rope toward the face, elbows high, squeezing the rear shoulders at the end range." },
  { id: "ex_cuban_press", name: "Cuban Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🙆", loadType: "external", instructions: "Curl the dumbbells up, rotate into an external-rotation position, then press overhead; reverse the sequence to lower." },
  { id: "ex_pike_pushup", name: "Pike Push-Up", muscle: "Shoulders", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 75, instructions: "Hips high in an inverted-V position, lower the head toward the floor, then press back up." },
  { id: "ex_handstand_pushup", name: "Handstand Push-Up", muscle: "Shoulders", secondary: ["Triceps", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Against a wall in a handstand, lower the head toward the floor, then press back up to full extension." },
  { id: "ex_btn_press", name: "Behind-the-Neck Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Bar racked behind the neck, press straight overhead until arms lock out, then lower with control." },
  { id: "ex_bradford_press", name: "Bradford Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Press the bar overhead and alternate tapping it in front of and behind the head without locking out." },
  { id: "ex_bottoms_up_kb_press", name: "Bottoms-Up Kettlebell Press", muscle: "Shoulders", secondary: ["Triceps", "Forearms"], icon: "🏋️", loadType: "external", instructions: "Holding the kettlebell upside down by the handle, press overhead while gripping tightly to keep it balanced." },
  { id: "ex_plate_front_raise", name: "Plate Front Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Holding a weight plate with both hands, raise it straight in front to shoulder height, then lower with control." },
  { id: "ex_y_raise", name: "Y-Raise", muscle: "Shoulders", secondary: ["Traps"], icon: "🙆", loadType: "external", instructions: "Lying incline or hinged forward, raise the arms up and out in a Y shape, then lower slowly." },
  { id: "ex_egyptian_lateral", name: "Egyptian Lateral Raise", muscle: "Shoulders", secondary: [], icon: "🙆", loadType: "external", instructions: "Leaning away from a low cable, raise the handle out to the side with a leaned torso for extra range, then lower." },
  { id: "ex_scott_press", name: "Scott Press", muscle: "Shoulders", secondary: ["Triceps"], icon: "🏋️", loadType: "external", instructions: "Press the bar overhead while leaning the torso back slightly, emphasizing the front delts through a longer range." },
  { id: "ex_around_the_world", name: "Around the World", muscle: "Shoulders", secondary: ["Front Delts", "Rear Delts"], icon: "🙆", loadType: "external", instructions: "Holding light dumbbells, sweep the arms in a wide circle from the front to overhead and around, then reverse." },

  // ----------------------------------- Arms ------------------------------------
  { id: "ex_curl", name: "Barbell Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Elbows pinned to the sides, curl the bar up to the shoulders, then lower under control." },
  { id: "ex_ez_bar_curl", name: "EZ-Bar Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Using the angled grip of an EZ-bar, curl up to the shoulders keeping elbows fixed, then lower under control." },
  { id: "ex_db_curl", name: "Dumbbell Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Elbows pinned to the sides, curl the dumbbells up to the shoulders, then lower under control." },
  { id: "ex_hammer", name: "Hammer Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Neutral grip dumbbells, curl straight up keeping the wrist fixed, then lower slowly." },
  { id: "ex_preacher_curl", name: "Preacher Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Arms braced on the preacher pad, curl the bar up, then lower until the arms are nearly straight." },
  { id: "ex_concentration_curl", name: "Concentration Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Elbow braced against the inner thigh, curl the dumbbell up with strict form, then lower slowly." },
  { id: "ex_spider_curl", name: "Spider Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Chest braced face-down on an incline bench, curl the weight up letting the arms hang free, then lower under control." },
  { id: "ex_cable_curl", name: "Cable Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Standing, curl the cable bar up toward the shoulders keeping elbows fixed, then lower under control." },
  { id: "ex_pushdown", name: "Triceps Pushdown", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Elbows fixed at the sides, push the bar down to full extension, then control the return." },
  { id: "ex_skullcrusher", name: "Skull Crusher", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Lying flat, lower the bar toward the forehead by bending the elbows, then extend back up." },
  { id: "ex_overhead_ext", name: "Overhead Triceps Extension", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Holding a dumbbell overhead with both hands, lower it behind the head, then extend the arms back up." },
  { id: "ex_cable_overhead_ext", name: "Cable Overhead Triceps Extension", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Facing away from a low cable, extend the rope overhead until the arms straighten, then lower with control." },
  { id: "ex_jm_press", name: "JM Press", muscle: "Arms", secondary: ["Chest", "Triceps"], icon: "💪", loadType: "external", instructions: "A hybrid of a close-grip press and skull crusher — lower the bar toward the neck/chin, then press up to lockout." },
  { id: "ex_closegrip_bench", name: "Close-Grip Bench Press", muscle: "Arms", secondary: ["Triceps", "Chest"], icon: "💪", loadType: "external", instructions: "Hands shoulder-width on the bar, lower to the chest keeping elbows tucked, then press up." },
  { id: "ex_kickback", name: "Triceps Kickback", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Hinged forward with the upper arm parallel to the floor, extend the forearm back, then return under control." },
  { id: "ex_wrist_curl", name: "Wrist Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Forearms braced on a bench, curl the bar up using only the wrists, then lower to a full stretch." },
  { id: "ex_reverse_wrist_curl", name: "Reverse Wrist Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Forearms braced on a bench, palms down, extend the wrists to lift the bar, then lower with control." },
  { id: "ex_dip", name: "Triceps Dip", muscle: "Arms", secondary: ["Chest", "Front Delts"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "On parallel bars, lower the body by bending the elbows to ~90°, then press back up to full extension." },
  { id: "ex_bench_dip", name: "Bench Dip", muscle: "Arms", secondary: ["Chest"], icon: "🤸", loadType: "bodyweight", bwPercent: 75, instructions: "Hands on a bench behind you, feet forward. Lower the hips toward the floor, then press back up." },
  { id: "ex_preacher_curl_machine", name: "Preacher Curl Machine", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Seated with arms on the pad, curl the handles up, then lower under control to a full stretch." },
  { id: "ex_zottman_curl", name: "Zottman Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Curl the dumbbells up with palms facing up, then rotate the palms down and lower slowly for the eccentric." },
  { id: "ex_reverse_curl", name: "Reverse Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Overhand grip on the bar, curl up keeping the wrists fixed, then lower under control." },
  { id: "ex_drag_curl", name: "Drag Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Keeping the bar close to the body, drag it up along the torso by driving the elbows back, then lower." },
  { id: "ex_incline_db_curl", name: "Incline Dumbbell Curl", muscle: "Arms", secondary: ["Biceps"], icon: "💪", loadType: "external", instructions: "Seated on an incline bench with arms hanging back, curl the dumbbells up, then lower to a deep stretch." },
  { id: "ex_crossbody_hammer", name: "Cross-Body Hammer Curl", muscle: "Arms", secondary: ["Forearms"], icon: "💪", loadType: "external", instructions: "Neutral grip dumbbells, curl one across the body toward the opposite shoulder, then lower and alternate." },
  { id: "ex_rope_pushdown", name: "Rope Triceps Pushdown", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Elbows fixed at the sides, push the rope down and apart at the bottom, then control the return." },
  { id: "ex_tate_press", name: "Tate Press", muscle: "Arms", secondary: ["Triceps"], icon: "💪", loadType: "external", instructions: "Lying flat, lower dumbbells with elbows flared out toward the chest, then press back up to lockout." },
  { id: "ex_wrist_roller", name: "Wrist Roller", muscle: "Arms", secondary: ["Forearms", "Grip"], icon: "💪", loadType: "external", instructions: "Roll the weight up and down on a suspended cord by rotating the wrists, working the forearms." },

  // ----------------------------------- Core ------------------------------------
  { id: "ex_cable_crunch", name: "Cable Crunch", muscle: "Core", secondary: [], icon: "🏋️", loadType: "external", instructions: "Kneel below the cable, crunch the elbows toward the hips by flexing the spine, not pulling with the arms." },
  { id: "ex_weighted_situp", name: "Weighted Sit-Up", muscle: "Core", secondary: [], icon: "🏋️", loadType: "external", instructions: "Holding a plate to the chest, curl the torso up off the floor, then lower with control." },
  { id: "ex_weighted_leg_raise", name: "Hanging Weighted Leg Raise", muscle: "Core", secondary: ["Grip"], icon: "🏋️", loadType: "external", instructions: "Hang from the bar with a dumbbell held between the feet, raise the legs to hip height, then lower under control." },
  { id: "ex_cable_woodchopper", name: "Cable Woodchopper", muscle: "Core", secondary: ["Shoulders"], icon: "🏋️", loadType: "external", instructions: "Cable set high, rotate the torso and pull the handle diagonally down across the body, then reverse with control." },
  { id: "ex_pallof_press", name: "Pallof Press", muscle: "Core", secondary: [], icon: "🏋️", loadType: "external", instructions: "Standing side-on to a cable, press the handle straight out from the chest resisting rotation, then return." },
  { id: "ex_plank", name: "Plank", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Forearms and toes on the floor, body in a straight line, brace the core and hold for time." },
  { id: "ex_side_plank", name: "Side Plank", muscle: "Core", secondary: ["Glutes"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Balanced on one forearm and the side of the foot, hips lifted in a straight line, hold for time." },
  { id: "ex_hanging_leg", name: "Hanging Leg Raise", muscle: "Core", secondary: ["Grip"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Hang from the bar, raise the legs to hip height or higher while keeping the swing controlled." },
  { id: "ex_toes_to_bar", name: "Toes to Bar", muscle: "Core", secondary: ["Grip", "Back"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Hanging from the bar, use momentum and core control to bring the toes up to touch the bar, then lower with control." },
  { id: "ex_situp", name: "Sit-Up", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Knees bent, feet anchored, curl the torso all the way up, then lower with control." },
  { id: "ex_bicycle_crunch", name: "Bicycle Crunch", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, alternate bringing elbow to opposite knee in a pedaling motion." },
  { id: "ex_russian_twist", name: "Russian Twist", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Seated, lean back slightly and rotate the torso side to side, tapping the floor on each side." },
  { id: "ex_ab_wheel", name: "Ab Wheel Rollout", muscle: "Core", secondary: ["Shoulders", "Back"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Kneeling, roll the wheel forward keeping the core braced, then pull back to the start." },
  { id: "ex_vup", name: "V-Up", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying flat, simultaneously raise the legs and torso to touch hands to toes, forming a V, then lower under control." },
  { id: "ex_leg_raise", name: "Lying Leg Raise", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, raise straight legs to vertical while keeping the lower back pressed down, then lower slowly." },
  { id: "ex_dead_bug", name: "Dead Bug", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back with arms and knees up, slowly extend opposite arm and leg while keeping the low back flat, then switch sides." },
  { id: "ex_hollow_hold", name: "Hollow Body Hold", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, press the low back down and lift the shoulders and legs off the floor, holding a slight banana shape." },
  { id: "ex_reverse_crunch", name: "Reverse Crunch", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, curl the hips up off the floor bringing the knees toward the chest, then lower slowly." },
  { id: "ex_cable_reverse_crunch", name: "Cable Reverse Crunch", muscle: "Core", secondary: [], icon: "🏋️", loadType: "external", instructions: "Ankle cable attached, curl the hips up toward the chest against the resistance, then lower with control." },
  { id: "ex_flutter_kicks", name: "Flutter Kicks", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back with legs extended, alternate small up-and-down kicks while keeping the low back pressed down." },
  { id: "ex_scissor_kicks", name: "Scissor Kicks", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Lying on the back, cross the extended legs over each other in a scissoring motion, keeping the low back flat." },
  { id: "ex_windshield_wipers", name: "Windshield Wipers", muscle: "Core", secondary: ["Obliques"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Hanging or lying with legs raised, rotate the legs side to side like a windshield wiper, keeping the core braced." },
  { id: "ex_lsit", name: "L-Sit", muscle: "Core", secondary: [], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Supported on the hands or parallel bars, hold the legs extended straight out in front, forming an L shape." },
  { id: "ex_copenhagen_plank", name: "Copenhagen Plank", muscle: "Core", secondary: ["Adductors"], icon: "🧘", loadType: "bodyweight", bwPercent: 100, instructions: "Top leg supported on a bench, hold a side plank position using the inner thigh of the top leg for support." },
  { id: "ex_suitcase_carry", name: "Suitcase Carry", muscle: "Core", secondary: ["Grip", "Obliques"], icon: "🏋️", loadType: "external", instructions: "Holding a heavy weight in one hand, walk with tall posture resisting the pull to one side, then switch hands." },

  // ---------------------------------- Cardio ------------------------------------
  { id: "ex_run", name: "Tempo Run", muscle: "Cardio", secondary: ["Legs"], icon: "🏃", loadType: "cardio", instructions: "Sustain a comfortably-hard pace for the target distance or time, focusing on steady breathing." },
  { id: "ex_sprint", name: "Sprint Intervals", muscle: "Cardio", secondary: ["Legs"], icon: "🏃", loadType: "cardio", instructions: "Alternate maximal-effort sprints with full recovery walks for the prescribed number of rounds." },
  { id: "ex_incline_walk", name: "Incline Treadmill Walk", muscle: "Cardio", secondary: ["Legs", "Glutes"], icon: "🏃", loadType: "cardio", instructions: "Set a steep incline and walk at a brisk, sustainable pace for the target time, holding the rails only if needed." },
  { id: "ex_rowerg", name: "Rowing Erg", muscle: "Cardio", secondary: ["Back", "Legs"], icon: "🚣", loadType: "cardio", instructions: "Drive with the legs first, then lean back and pull the handle to the ribs, reversing smoothly." },
  { id: "ex_ski_erg", name: "Ski Erg", muscle: "Cardio", secondary: ["Back", "Core"], icon: "🎿", loadType: "cardio", instructions: "Hinge at the hips and pull both handles down together using the lats and core, then reset with control." },
  { id: "ex_bike", name: "Bike Intervals", muscle: "Cardio", secondary: ["Legs"], icon: "🚴", loadType: "cardio", instructions: "Alternate hard efforts with easy recovery spins for the prescribed number of rounds." },
  { id: "ex_jumprope", name: "Jump Rope", muscle: "Cardio", secondary: ["Calves"], icon: "🪢", loadType: "cardio", instructions: "Keep a light, steady bounce and consistent rope turnover for the target time or reps." },
  { id: "ex_stairclimber", name: "Stair Climber", muscle: "Cardio", secondary: ["Legs", "Glutes"], icon: "🪜", loadType: "cardio", instructions: "Maintain an upright posture and steady step cadence for the target duration." },
  { id: "ex_elliptical", name: "Elliptical", muscle: "Cardio", secondary: ["Legs"], icon: "🚴", loadType: "cardio", instructions: "Maintain a smooth, steady stride and push through both the arms and legs for the target duration." },
  { id: "ex_assault_bike", name: "Assault Bike", muscle: "Cardio", secondary: ["Legs", "Arms"], icon: "🚴", loadType: "cardio", instructions: "Drive both the arms and legs together at a hard, sustainable pace for the prescribed intervals." },
  { id: "ex_battle_ropes", name: "Battle Ropes", muscle: "Cardio", secondary: ["Shoulders", "Core"], icon: "🪢", loadType: "cardio", instructions: "Alternate slamming the ropes in waves, keeping the core braced, for the target time." },
  { id: "ex_swimming", name: "Swimming", muscle: "Cardio", secondary: ["Back", "Shoulders"], icon: "🏊", loadType: "cardio", instructions: "Sustain steady, efficient strokes and breathing rhythm for the target distance or time." },
  { id: "ex_shadow_boxing", name: "Shadow Boxing", muscle: "Cardio", secondary: ["Arms", "Core"], icon: "🥊", loadType: "cardio", instructions: "Throw combinations at a steady pace, staying light on the feet, for the target rounds or time." },
  { id: "ex_mountain_climber", name: "Mountain Climber", muscle: "Cardio", secondary: ["Core"], icon: "🤸", loadType: "cardio", instructions: "In a plank position, drive the knees toward the chest rapidly, alternating legs." },
  { id: "ex_burpee", name: "Burpee", muscle: "Cardio", secondary: ["Chest", "Legs", "Core"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Drop into a squat, kick back into a plank, perform a push-up, then jump feet in and explode upward." },
  { id: "ex_treadmill_run", name: "Treadmill Run (Steady State)", muscle: "Cardio", secondary: ["Legs"], icon: "🏃", loadType: "cardio", instructions: "Maintain a steady, conversational pace on the treadmill for the target time or distance." },
  { id: "ex_stationary_bike", name: "Stationary Bike", muscle: "Cardio", secondary: ["Legs"], icon: "🚴", loadType: "cardio", instructions: "Maintain a steady cadence and resistance for the target time, adjusting effort as prescribed." },
  { id: "ex_versaclimber", name: "Versaclimber", muscle: "Cardio", secondary: ["Legs", "Back"], icon: "🪜", loadType: "cardio", instructions: "Drive with alternating arms and legs in a climbing motion, keeping a steady rhythm for the target time." },
  { id: "ex_sled_conditioning", name: "Sled Conditioning", muscle: "Cardio", secondary: ["Legs"], icon: "🏃", loadType: "cardio", instructions: "Push or drag a loaded sled for short, hard efforts with brief recovery between rounds." },
  { id: "ex_high_knees", name: "High Knees", muscle: "Cardio", secondary: ["Legs", "Core"], icon: "🏃", loadType: "cardio", instructions: "Drive the knees up toward the chest rapidly while pumping the arms, staying light on the feet." },
  { id: "ex_butt_kicks", name: "Butt Kicks", muscle: "Cardio", secondary: ["Hamstrings"], icon: "🏃", loadType: "cardio", instructions: "Jog in place kicking the heels up toward the glutes rapidly, staying light and quick." },

  // -------------------------------- Full Body -----------------------------------
  { id: "ex_clean_jerk", name: "Clean and Jerk", muscle: "Full Body", secondary: ["Legs", "Shoulders", "Back"], icon: "🏋️", loadType: "external", instructions: "Pull the bar explosively from the floor to the shoulders, then dip and drive it overhead to lock out." },
  { id: "ex_power_clean", name: "Power Clean", muscle: "Full Body", secondary: ["Legs", "Back"], icon: "🏋️", loadType: "external", instructions: "Pull the bar explosively from the floor, extending the hips fully, then catch it on the shoulders in a quarter squat." },
  { id: "ex_snatch", name: "Snatch", muscle: "Full Body", secondary: ["Legs", "Shoulders", "Back"], icon: "🏋️", loadType: "external", instructions: "Pull the bar explosively from the floor to overhead in one motion, catching it in a full squat." },
  { id: "ex_kb_swing", name: "Kettlebell Swing", muscle: "Full Body", secondary: ["Glutes", "Hamstrings", "Core"], icon: "🏋️", loadType: "external", instructions: "Hinge at the hips and swing the kettlebell up to chest height using hip drive, not the arms." },
  { id: "ex_thruster", name: "Thruster", muscle: "Full Body", secondary: ["Legs", "Shoulders"], icon: "🏋️", loadType: "external", instructions: "Front squat the bar down, then drive up and press it overhead in one fluid motion." },
  { id: "ex_wall_ball", name: "Wall Ball Shot", muscle: "Full Body", secondary: ["Legs", "Shoulders"], icon: "🏋️", loadType: "external", instructions: "Squat down holding the ball at the chest, then drive up and throw it to a target on the wall, catching it on the way down." },
  { id: "ex_farmers_carry", name: "Farmer's Carry", muscle: "Full Body", secondary: ["Grip", "Core", "Traps"], icon: "🏋️", loadType: "external", instructions: "Holding a heavy weight in each hand, walk with tall posture and braced core for the target distance." },
  { id: "ex_devils_press", name: "Devil's Press", muscle: "Full Body", secondary: ["Shoulders", "Legs", "Core"], icon: "🏋️", loadType: "external", instructions: "From a burpee with dumbbells in hand, explode up and swing the dumbbells overhead to full lockout." },
  { id: "ex_turkish_getup", name: "Turkish Get-Up", muscle: "Full Body", secondary: ["Core", "Shoulders"], icon: "🏋️", loadType: "external", instructions: "Holding a weight overhead, move from lying to standing through a controlled sequence, then reverse back down." },
  { id: "ex_man_maker", name: "Man Maker", muscle: "Full Body", secondary: ["Back", "Shoulders", "Legs"], icon: "🏋️", loadType: "external", instructions: "From a plank with dumbbells, row each arm, perform a push-up, then jump the feet in and clean-and-press both dumbbells overhead." },
  { id: "ex_bear_crawl", name: "Bear Crawl", muscle: "Full Body", secondary: ["Core", "Shoulders"], icon: "🤸", loadType: "bodyweight", bwPercent: 100, instructions: "Hands and feet on the floor, knees hovering, crawl forward moving opposite hand and foot together." },
  { id: "ex_barbell_complex", name: "Barbell Complex", muscle: "Full Body", secondary: ["Legs", "Back", "Shoulders"], icon: "🏋️", loadType: "external", instructions: "String several barbell movements together without setting the bar down, moving through the full body under fatigue." },
  { id: "ex_db_snatch", name: "Dumbbell Snatch", muscle: "Full Body", secondary: ["Shoulders", "Legs", "Back"], icon: "🏋️", loadType: "external", instructions: "Hike the dumbbell back between the legs, then pull it explosively overhead to lockout in one motion." },
  { id: "ex_sandbag_carry", name: "Sandbag Carry", muscle: "Full Body", secondary: ["Core", "Grip"], icon: "🏋️", loadType: "external", instructions: "Holding a sandbag against the chest or on a shoulder, walk with tall posture for the target distance." },
  { id: "ex_sled_drag_harness", name: "Sled Drag (Harness)", muscle: "Full Body", secondary: ["Legs", "Core"], icon: "🏋️", loadType: "external", instructions: "Attached via a harness, drag the loaded sled forward with steady, driving steps." },
  { id: "ex_tire_flip", name: "Tire Flip", muscle: "Full Body", secondary: ["Legs", "Back", "Chest"], icon: "🏋️", loadType: "external", instructions: "Hinge down, drive through the legs and hips to flip the tire forward, then reset and repeat." },
];
const EX_BY_ID = Object.fromEntries(EXERCISE_LIBRARY.map((e) => [e.id, e]));

// ---- Custom exercises (user-added) live in shared state, layered on top of the
// built-in library at render time. See syncExerciseIndex()/getEx() below. ----
let CUSTOM_EX_INDEX = {};
function syncExerciseIndex(customExercises) {
  CUSTOM_EX_INDEX = customExercises || {};
}
function getEx(exerciseId) {
  return CUSTOM_EX_INDEX[exerciseId] || EX_BY_ID[exerciseId];
}
function allExercises(customExercises) {
  return [...EXERCISE_LIBRARY, ...Object.values(customExercises || {})];
}
function newCustomExercise({ name, muscle, secondary, icon, loadType, bwPercent, instructions, createdBy }) {
  return {
    id: uid("cex"),
    name: name.trim(),
    muscle: muscle || "Chest",
    secondary: Array.isArray(secondary) ? secondary : [],
    icon: icon || "⭐",
    loadType: loadType || "external",
    bwPercent: loadType === "bodyweight" ? (Number(bwPercent) || 100) : undefined,
    instructions: (instructions || "").trim() || "Custom exercise — added by you. Tap into it any time to add form notes.",
    custom: true,
    createdBy: createdBy || null,
  };
}

// ---- Bodyweight load estimation --------------------------------------------
// There's no scale under a push-up, so we estimate the load the same way exercise
// science commonly does: total load ≈ (member's bodyweight × the fraction of it
// that movement pattern puts through the working muscles) + any extra weight the
// person deliberately adds (a weighted vest, a dip belt, a dumbbell between the
// feet, etc). The percentages above are widely-cited coaching estimates, not a
// lab measurement for any one body — they exist so bodyweight work still shows up
// on the same volume/PR/progress charts as barbell work, not to be exact to the
// gram. Members can always tune their bodyweight in Profile for a better estimate.
const DEFAULT_BODYWEIGHT_KG = 70;
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_AGE = 25;
const DEFAULT_SEX = "male";
const DEFAULT_ACTIVITY_LEVEL = "moderate";
// Standard Mifflin-St Jeor activity multipliers, used to turn BMR into an
// estimated daily calorie need (TDEE) for the Diet tab. These are the same
// widely-cited coaching estimates used across most calorie-tracking apps —
// not a lab measurement of any one person's true energy expenditure.
const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", desc: "Little or no exercise", mult: 1.2 },
  { id: "light", label: "Light", desc: "Light exercise 1–3 days/week", mult: 1.375 },
  { id: "moderate", label: "Moderate", desc: "Moderate exercise 3–5 days/week", mult: 1.55 },
  { id: "active", label: "Active", desc: "Hard exercise 6–7 days/week", mult: 1.725 },
  { id: "very_active", label: "Very active", desc: "Very hard training + physical job", mult: 1.9 },
];
// The "workout goal" (GOALS, above) picks a training style — it says nothing
// about whether someone should be eating in a deficit, a surplus, or at
// maintenance, so calorieTargetFor/macroTargetsFor must not read from it.
// DIET_GOALS is the separate, diet-specific phase: it adjusts the maintenance
// TDEE by a percentage (a "cut" eats less than it burns, a "bulk" eats more,
// "maintain" changes nothing) and nudges the protein-per-kg guideline higher
// on a cut, which is standard cutting-phase coaching advice to protect
// muscle in a deficit. These are still coaching-estimate percentages, not a
// medical prescription — same caveat as calcBMR above.
const DIET_GOALS = [
  { id: "maintain", label: "Maintain", icon: "⚖️", desc: "Eat around maintenance — calorie target equals estimated TDEE.", kcalPct: 0, proteinPerKg: 1.8 },
  { id: "cut", label: "Lose fat", icon: "🔥", desc: "~20% calorie deficit below TDEE, protein raised to protect muscle.", kcalPct: -0.20, proteinPerKg: 2.0 },
  { id: "bulk", label: "Build muscle", icon: "💪", desc: "~12% calorie surplus above TDEE for lean gain.", kcalPct: 0.12, proteinPerKg: 1.8 },
];
const DEFAULT_DIET_GOAL = "maintain";
function dietGoalInfo(id) {
  return DIET_GOALS.find((g) => g.id === id) || DIET_GOALS.find((g) => g.id === DEFAULT_DIET_GOAL);
}
function computeBodyweightLoad(ex, addedWeight, bodyweightKg) {
  const bw = Number(bodyweightKg) || DEFAULT_BODYWEIGHT_KG;
  const pct = (ex && Number(ex.bwPercent)) || 100;
  return Math.round(bw * (pct / 100) + (Number(addedWeight) || 0));
}

const WORKOUT_QUOTES = [
  "Let's become stronger than yesterday.",
  "Today's session is another step toward your goal.",
  "Small improvements every day create extraordinary results.",
  "Discipline is choosing between what you want now and what you want most.",
  "The only bad workout is the one that didn't happen.",
  "Show up. That's most of the battle, every single time.",
  "Your future self is already thanking you for this one.",
  "Progress, not perfection — one set at a time.",
  "Consistency beats intensity when intensity isn't sustainable.",
  "You don't have to be great to start, just start.",
  "Every rep today is a deposit into tomorrow's strength.",
  "Make today's version of you proud.",
];
const REST_QUOTES = [
  "Recovery is where the growth actually happens.",
  "Rest hard so you can train hard.",
  "A quiet day today builds the strong day tomorrow.",
  "Muscles grow when you sleep and rest, not just when you lift.",
  "Taking today off is still part of the plan.",
  "Stretch, hydrate, breathe — this counts too.",
];
const RECOVERY_TIPS = [
  "Aim for 7-9 hours of sleep tonight — it's the biggest recovery lever you have.",
  "Sip water throughout the day; even mild dehydration slows recovery.",
  "A short walk or light stretch keeps blood flowing without adding fatigue.",
  "Protein spread across meals today helps repair yesterday's work.",
  "Foam rolling or a gentle mobility flow can ease tomorrow's session.",
];

// ---- Achievement helper aggregates -----------------------------------
// A handful of achievements look across a member's *entire* logged history
// at once (best week, best single session, a muscle group's session count,
// account tenure) rather than one exercise in isolation. These small, pure
// helpers compute those aggregates from the same member object every
// achievement check already receives — no new state, no new plumbing.
function flattenHistory(s) {
  const out = [];
  Object.keys(s.history || {}).forEach((exId) => {
    (s.history[exId] || []).forEach((h) => out.push({ ...h, exerciseId: exId }));
  });
  return out;
}
function maxWeightFor(s, exerciseId) {
  return (s.history?.[exerciseId] || []).reduce((mx, h) => Math.max(mx, h.weight || 0), 0);
}
function bigThreeTotal(s) {
  return maxWeightFor(s, "ex_bench") + maxWeightFor(s, "ex_squat") + maxWeightFor(s, "ex_deadlift");
}
function muscleSessionCount(s, muscle) {
  return Object.keys(s.history || {}).reduce((sum, exId) => {
    const ex = getEx(exId);
    return ex?.muscle === muscle ? sum + (s.history[exId] || []).length : sum;
  }, 0);
}
function volumeByDate(s) {
  const byDate = {};
  flattenHistory(s).forEach((h) => { byDate[h.date] = (byDate[h.date] || 0) + (h.volume || 0); });
  return byDate;
}
function bestSessionVolume(s) {
  return Object.values(volumeByDate(s)).reduce((mx, v) => Math.max(mx, v), 0);
}
function bestWeekVolume(s) {
  const byDate = volumeByDate(s);
  const dates = Object.keys(byDate).sort();
  let best = 0, lo = 0, sum = 0;
  for (let hi = 0; hi < dates.length; hi++) {
    sum += byDate[dates[hi]];
    while (dates[hi] > addDaysISO(dates[lo], 6)) { sum -= byDate[dates[lo]]; lo++; }
    best = Math.max(best, sum);
  }
  return best;
}
function bestMonthDayCount(s) {
  const months = {};
  Object.keys(s.worklogs || {}).forEach((iso) => {
    if (!s.worklogs[iso]?.completedAt) return;
    const ym = iso.slice(0, 7);
    months[ym] = (months[ym] || 0) + 1;
  });
  return Object.values(months).reduce((mx, v) => Math.max(mx, v), 0);
}
function daysSinceJoined(s) {
  if (!s.joinedAt) return 0;
  return Math.round((isoToDate(todayISO()) - isoToDate(s.joinedAt)) / 86400000);
}
function maxRepsAny(s) {
  return flattenHistory(s).reduce((mx, h) => Math.max(mx, h.reps || 0), 0);
}
function maxWeightAny(s) {
  return flattenHistory(s).reduce((mx, h) => Math.max(mx, h.weight || 0), 0);
}
function musclesTrainedOnDate(s, iso) {
  const wl = s.worklogs?.[iso];
  if (!wl) return new Set();
  return new Set(Object.keys(wl.exercises || {}).map((exId) => getEx(exId)?.muscle).filter(Boolean));
}
function bestMusclesInADay(s) {
  return Object.keys(s.worklogs || {}).reduce((mx, iso) => Math.max(mx, musclesTrainedOnDate(s, iso).size), 0);
}
function hasLoggedLoadType(s, loadType) {
  return Object.keys(s.history || {}).some((exId) => (s.history[exId] || []).length > 0 && getEx(exId)?.loadType === loadType);
}

const ACHIEVEMENTS = [
  // ---- First steps ----
  { id: "ach_first", name: "First Rep", desc: "Complete your first workout", icon: "🎉", check: (s) => s.totalWorkouts >= 1 },
  { id: "ach_first_pr", name: "New Record", desc: "Set your first personal record", icon: "🥇", check: (s) => s.prCount >= 1 },
  { id: "ach_first_note", name: "Note Taker", desc: "Leave notes on 3 different exercises", icon: "📝", check: (s) => Object.keys(s.exerciseNotes || {}).length >= 3 },
  { id: "ach_first_photo", name: "Say Cheese", desc: "Upload your first progress photo", icon: "📸", check: (s) => (s.photoCount || 0) >= 1 },
  { id: "ach_first_bodyweight", name: "Bodyweight Believer", desc: "Log your first bodyweight exercise", icon: "🤸", check: (s) => hasLoggedLoadType(s, "bodyweight") },
  { id: "ach_first_cardio", name: "Cardio Kickoff", desc: "Log your first cardio session", icon: "🏃", check: (s) => hasLoggedLoadType(s, "cardio") },

  // ---- Streaks ----
  { id: "ach_streak3", name: "Getting Started", desc: "Reach a 3-day streak", icon: "🌱", check: (s) => s.longestStreak >= 3 },
  { id: "ach_streak7", name: "On Fire", desc: "Reach a 7-day streak", icon: "🔥", check: (s) => s.longestStreak >= 7 },
  { id: "ach_streak14", name: "Two Weeks Strong", desc: "Reach a 14-day streak", icon: "🗓️", check: (s) => s.longestStreak >= 14 },
  { id: "ach_streak30", name: "Unstoppable", desc: "Reach a 30-day streak", icon: "⚡", check: (s) => s.longestStreak >= 30 },
  { id: "ach_streak60", name: "Iron Habit", desc: "Reach a 60-day streak", icon: "🧲", check: (s) => s.longestStreak >= 60 },
  { id: "ach_streak100", name: "Legendary Streak", desc: "Reach a 100-day streak", icon: "🐉", check: (s) => s.longestStreak >= 100 },
  { id: "ach_streak180", name: "Half-Year Habit", desc: "Reach a 180-day streak", icon: "🏔️", check: (s) => s.longestStreak >= 180 },
  { id: "ach_streak365", name: "Full Year", desc: "Reach a 365-day streak", icon: "🎇", check: (s) => s.longestStreak >= 365 },
  { id: "ach_weekend", name: "Weekend Warrior", desc: "Log a workout on both a Saturday and a Sunday", icon: "🏖️", check: (s) => {
    const days = new Set(Object.keys(s.worklogs || {}).filter((iso) => s.worklogs[iso]?.completedAt).map((iso) => dayKeyForISO(iso)));
    return days.has("sat") && days.has("sun");
  } },
  { id: "ach_alldays", name: "Consistency King", desc: "Log a workout on every day of the week at least once", icon: "👑", check: (s) => {
    const days = new Set(Object.keys(s.worklogs || {}).filter((iso) => s.worklogs[iso]?.completedAt).map((iso) => dayKeyForISO(iso)));
    return DAY_ORDER.every((d) => days.has(d));
  } },
  { id: "ach_perfect_month", name: "Perfect Month", desc: "Log a workout on 20+ days within a single calendar month", icon: "🌕", check: (s) => bestMonthDayCount(s) >= 20 },

  // ---- Workout count ----
  { id: "ach_workouts5", name: "High Five", desc: "5 workouts completed", icon: "✋", check: (s) => s.totalWorkouts >= 5 },
  { id: "ach_workouts10", name: "Getting Reps In", desc: "10 workouts completed", icon: "🔟", check: (s) => s.totalWorkouts >= 10 },
  { id: "ach_workouts25", name: "Regular", desc: "25 workouts completed", icon: "📅", check: (s) => s.totalWorkouts >= 25 },
  { id: "ach_workouts50", name: "Dedicated", desc: "50 workouts completed", icon: "🥋", check: (s) => s.totalWorkouts >= 50 },
  { id: "ach_workouts100", name: "Centurion", desc: "100 workouts completed", icon: "💯", check: (s) => s.totalWorkouts >= 100 },
  { id: "ach_workouts250", name: "Veteran", desc: "250 workouts completed", icon: "🎖️", check: (s) => s.totalWorkouts >= 250 },
  { id: "ach_workouts500", name: "Iron Legend", desc: "500 workouts completed", icon: "🏛️", check: (s) => s.totalWorkouts >= 500 },
  { id: "ach_workouts1000", name: "Gym Immortal", desc: "1,000 workouts completed", icon: "🛡️", check: (s) => s.totalWorkouts >= 1000 },
  { id: "ach_workouts2000", name: "Forged in Iron", desc: "2,000 workouts completed", icon: "⚒️", check: (s) => s.totalWorkouts >= 2000 },

  // ---- Volume ----
  { id: "ach_volume100", name: "Loading Up", desc: "100 kg total volume lifted", icon: "🧱", check: (s) => s.totalVolume >= 100 },
  { id: "ach_volume1k", name: "First Ton", desc: "1,000 kg total volume lifted", icon: "🪨", check: (s) => s.totalVolume >= 1000 },
  { id: "ach_volume10k", name: "Heavy Lifter", desc: "10,000 kg total volume", icon: "💪", check: (s) => s.totalVolume >= 10000 },
  { id: "ach_volume50k", name: "Iron Will", desc: "50,000 kg total volume", icon: "🦾", check: (s) => s.totalVolume >= 50000 },
  { id: "ach_volume100k", name: "Six Figures", desc: "100,000 kg total volume", icon: "💎", check: (s) => s.totalVolume >= 100000 },
  { id: "ach_volume250k", name: "Quarter Million", desc: "250,000 kg total volume", icon: "🚂", check: (s) => s.totalVolume >= 250000 },
  { id: "ach_volume500k", name: "Half Million Club", desc: "500,000 kg total volume", icon: "🛳️", check: (s) => s.totalVolume >= 500000 },
  { id: "ach_volume1m", name: "Million Kilogram Club", desc: "1,000,000 kg total volume", icon: "🚀", check: (s) => s.totalVolume >= 1000000 },
  { id: "ach_volume2m", name: "Two Million Club", desc: "2,000,000 kg total volume", icon: "🌌", check: (s) => s.totalVolume >= 2000000 },

  // ---- Level / XP ----
  { id: "ach_level3", name: "Warming Up", desc: "Reach level 3", icon: "🔆", check: (s) => s.level >= 3 },
  { id: "ach_level5", name: "Rising Star", desc: "Reach level 5", icon: "⭐", check: (s) => s.level >= 5 },
  { id: "ach_level10", name: "Elite", desc: "Reach level 10", icon: "🏆", check: (s) => s.level >= 10 },
  { id: "ach_level20", name: "Champion", desc: "Reach level 20", icon: "👑", check: (s) => s.level >= 20 },
  { id: "ach_level30", name: "Legend", desc: "Reach level 30", icon: "🌟", check: (s) => s.level >= 30 },
  { id: "ach_level50", name: "Mythic", desc: "Reach level 50", icon: "🔮", check: (s) => s.level >= 50 },
  { id: "ach_level75", name: "Titan", desc: "Reach level 75", icon: "🗿", check: (s) => s.level >= 75 },
  { id: "ach_level100", name: "Level 100 Legend", desc: "Reach level 100", icon: "💠", check: (s) => s.level >= 100 },

  // ---- Personal records ----
  { id: "ach_pr5", name: "Record Breaker", desc: "Set 5 personal records", icon: "📈", check: (s) => s.prCount >= 5 },
  { id: "ach_pr20", name: "PR Machine", desc: "Set 20 personal records", icon: "⚙️", check: (s) => s.prCount >= 20 },
  { id: "ach_pr50", name: "Record Hunter", desc: "Set 50 personal records", icon: "🎯", check: (s) => s.prCount >= 50 },
  { id: "ach_pr100", name: "Record Collector", desc: "Set 100 personal records", icon: "🏅", check: (s) => s.prCount >= 100 },

  // ---- Exercise variety ----
  { id: "ach_variety5", name: "Branching Out", desc: "Log 5 different exercises", icon: "🌿", check: (s) => Object.keys(s.history || {}).filter((k) => (s.history[k] || []).length > 0).length >= 5 },
  { id: "ach_variety10", name: "Well Rounded", desc: "Log 10 different exercises", icon: "🧩", check: (s) => Object.keys(s.history || {}).filter((k) => (s.history[k] || []).length > 0).length >= 10 },
  { id: "ach_variety25", name: "Explorer", desc: "Log 25 different exercises", icon: "🗺️", check: (s) => Object.keys(s.history || {}).filter((k) => (s.history[k] || []).length > 0).length >= 25 },
  { id: "ach_variety50", name: "Master of All", desc: "Log 50 different exercises", icon: "🎓", check: (s) => Object.keys(s.history || {}).filter((k) => (s.history[k] || []).length > 0).length >= 50 },
  { id: "ach_variety75", name: "Exercise Encyclopedia", desc: "Log 75 different exercises", icon: "📚", check: (s) => Object.keys(s.history || {}).filter((k) => (s.history[k] || []).length > 0).length >= 75 },

  // ---- Milestone lifts ----
  { id: "ach_bench_bw", name: "Bodyweight Bench", desc: "Bench press your own bodyweight", icon: "🏋️", check: (s) => (s.history?.ex_bench || []).some((h) => h.weight >= (s.bodyweightKg || DEFAULT_BODYWEIGHT_KG)) },
  { id: "ach_bench_100", name: "Century Bench", desc: "Bench press 100 kg", icon: "💥", check: (s) => (s.history?.ex_bench || []).some((h) => h.weight >= 100) },
  { id: "ach_squat_2bw", name: "Double Bodyweight Squat", desc: "Squat twice your bodyweight", icon: "🦵", check: (s) => (s.history?.ex_squat || []).some((h) => h.weight >= 2 * (s.bodyweightKg || DEFAULT_BODYWEIGHT_KG)) },
  { id: "ach_squat_140", name: "Squat 140", desc: "Squat 140 kg", icon: "🔩", check: (s) => (s.history?.ex_squat || []).some((h) => h.weight >= 140) },
  { id: "ach_deadlift_2bw", name: "Deadlift Beast", desc: "Deadlift twice your bodyweight", icon: "🐘", check: (s) => (s.history?.ex_deadlift || []).some((h) => h.weight >= 2 * (s.bodyweightKg || DEFAULT_BODYWEIGHT_KG)) },
  { id: "ach_deadlift_180", name: "Deadlift 180", desc: "Deadlift 180 kg", icon: "⚓", check: (s) => (s.history?.ex_deadlift || []).some((h) => h.weight >= 180) },
  { id: "ach_pullup_10", name: "Pull-Up Pro", desc: "Complete 10 pull-ups in a single set", icon: "🧗", check: (s) => (s.history?.ex_pullup || []).some((h) => h.reps >= 10) },
  { id: "ach_pushup_50", name: "Push-Up Machine", desc: "Complete 50 push-ups in a single set", icon: "🤸", check: (s) => (s.history?.ex_pushup || []).some((h) => h.reps >= 50) },
  { id: "ach_ohp_bw", name: "Overhead Bodyweight", desc: "Overhead press your own bodyweight", icon: "🎯", check: (s) => (s.history?.ex_ohp || []).some((h) => h.weight >= (s.bodyweightKg || DEFAULT_BODYWEIGHT_KG)) },
  { id: "ach_row_100", name: "Row 100", desc: "Barbell row 100 kg", icon: "🚣", check: (s) => (s.history?.ex_row || []).some((h) => h.weight >= 100) },
  { id: "ach_frontsquat_100", name: "Front Squat 100", desc: "Front squat 100 kg", icon: "🦵", check: (s) => (s.history?.ex_frontsquat || []).some((h) => h.weight >= 100) },
  { id: "ach_rdl_120", name: "RDL 120", desc: "Romanian deadlift 120 kg", icon: "🦵", check: (s) => (s.history?.ex_rdl || []).some((h) => h.weight >= 120) },
  { id: "ach_hipthrust_150", name: "Hip Thrust 150", desc: "Barbell hip thrust 150 kg", icon: "🍑", check: (s) => (s.history?.ex_hip_thrust || []).some((h) => h.weight >= 150) },
  { id: "ach_legpress_200", name: "Leg Press 200", desc: "Leg press 200 kg", icon: "🦿", check: (s) => (s.history?.ex_legpress || []).some((h) => h.weight >= 200) },
  { id: "ach_curl_40", name: "Curl 40", desc: "Barbell curl 40 kg", icon: "💪", check: (s) => (s.history?.ex_curl || []).some((h) => h.weight >= 40) },
  { id: "ach_chinup_15", name: "Chin-Up Champion", desc: "Complete 15 chin-ups in a single set", icon: "🧗", check: (s) => (s.history?.ex_chinup || []).some((h) => h.reps >= 15) },
  { id: "ach_dip_20", name: "Dip Devotee", desc: "Complete 20 triceps dips in a single set", icon: "🤸", check: (s) => (s.history?.ex_dip || []).some((h) => h.reps >= 20) },
  { id: "ach_muscleup_1", name: "First Muscle-Up", desc: "Land your first muscle-up", icon: "🚀", check: (s) => (s.history?.ex_muscle_up || []).some((h) => h.reps >= 1) },
  { id: "ach_wpullup_1", name: "Weighted Pull-Up", desc: "Complete a weighted pull-up with added load", icon: "⛓️", check: (s) => (s.history?.ex_weighted_pullup || []).some((h) => (h.addedWeight || 0) > 0) },
  { id: "ach_hspu_1", name: "Handstand Push-Up", desc: "Complete a handstand push-up", icon: "🙃", check: (s) => (s.history?.ex_handstand_pushup || []).some((h) => h.reps >= 1) },

  // ---- Powerlifting total (best-ever bench + squat + deadlift, not necessarily same day) ----
  { id: "ach_total300", name: "Novice Total", desc: "Bench + squat + deadlift best-ever total reaches 300 kg", icon: "🥉", check: (s) => bigThreeTotal(s) >= 300 },
  { id: "ach_total500", name: "Intermediate Total", desc: "Bench + squat + deadlift best-ever total reaches 500 kg", icon: "🥈", check: (s) => bigThreeTotal(s) >= 500 },
  { id: "ach_total700", name: "Advanced Total", desc: "Bench + squat + deadlift best-ever total reaches 700 kg", icon: "🥇", check: (s) => bigThreeTotal(s) >= 700 },
  { id: "ach_total900", name: "Elite Total", desc: "Bench + squat + deadlift best-ever total reaches 900 kg", icon: "👑", check: (s) => bigThreeTotal(s) >= 900 },

  // ---- Weekly & single-session volume ----
  { id: "ach_bigweek_3k", name: "Big Week", desc: "3,000 kg total volume within any 7-day span", icon: "📆", check: (s) => bestWeekVolume(s) >= 3000 },
  { id: "ach_bigweek_10k", name: "Monster Week", desc: "10,000 kg total volume within any 7-day span", icon: "🌊", check: (s) => bestWeekVolume(s) >= 10000 },
  { id: "ach_bigsession_1k", name: "Heavy Session", desc: "1,000 kg total volume in a single session", icon: "🔋", check: (s) => bestSessionVolume(s) >= 1000 },
  { id: "ach_bigsession_3k", name: "Monster Session", desc: "3,000 kg total volume in a single session", icon: "⚡", check: (s) => bestSessionVolume(s) >= 3000 },

  // ---- Engagement: notes & photos ----
  { id: "ach_notes10", name: "Journaling Habit", desc: "Leave notes on 10 different exercises", icon: "🖊️", check: (s) => Object.keys(s.exerciseNotes || {}).length >= 10 },
  { id: "ach_notes25", name: "Master Chronicler", desc: "Leave notes on 25 different exercises", icon: "📔", check: (s) => Object.keys(s.exerciseNotes || {}).length >= 25 },
  { id: "ach_photos10", name: "Progress Documentarian", desc: "Upload 10 progress photos", icon: "🎞️", check: (s) => (s.photoCount || 0) >= 10 },
  { id: "ach_photos30", name: "Visual Diary", desc: "Upload 30 progress photos", icon: "🗂️", check: (s) => (s.photoCount || 0) >= 30 },

  // ---- Tenure ----
  { id: "ach_tenure90", name: "Three Months In", desc: "Be a member for 90 days", icon: "🌤️", check: (s) => daysSinceJoined(s) >= 90 },
  { id: "ach_tenure365", name: "One-Year Anniversary", desc: "Be a member for 1 year", icon: "🎂", check: (s) => daysSinceJoined(s) >= 365 },
  { id: "ach_tenure730", name: "Two-Year Veteran", desc: "Be a member for 2 years", icon: "🏵️", check: (s) => daysSinceJoined(s) >= 730 },

  // ---- Muscle-group specialists ----
  { id: "ach_spec_chest", name: "Chest Specialist", desc: "Log 30 chest sessions", icon: "🎽", check: (s) => muscleSessionCount(s, "Chest") >= 30 },
  { id: "ach_spec_back", name: "Back Specialist", desc: "Log 30 back sessions", icon: "🚣", check: (s) => muscleSessionCount(s, "Back") >= 30 },
  { id: "ach_spec_legs", name: "Leg Day Legend", desc: "Log 30 leg sessions", icon: "🦵", check: (s) => muscleSessionCount(s, "Legs") >= 30 },
  { id: "ach_spec_shoulders", name: "Shoulder Sculptor", desc: "Log 30 shoulder sessions", icon: "🙆", check: (s) => muscleSessionCount(s, "Shoulders") >= 30 },
  { id: "ach_spec_arms", name: "Arm Day Enthusiast", desc: "Log 30 arm sessions", icon: "💪", check: (s) => muscleSessionCount(s, "Arms") >= 30 },
  { id: "ach_spec_glutes", name: "Glute Gains", desc: "Log 30 glute sessions", icon: "🍑", check: (s) => muscleSessionCount(s, "Glutes") >= 30 },
  { id: "ach_spec_core", name: "Core Crusher", desc: "Log 30 core sessions", icon: "🧘", check: (s) => muscleSessionCount(s, "Core") >= 30 },
  { id: "ach_spec_cardio", name: "Cardio Devotee", desc: "Log 30 cardio sessions", icon: "🏃", check: (s) => muscleSessionCount(s, "Cardio") >= 30 },
  { id: "ach_fullbody_day", name: "Full Body Day", desc: "Train 4+ different muscle groups in a single day", icon: "🌈", check: (s) => bestMusclesInADay(s) >= 4 },

  // ---- Generic feats (any exercise) ----
  { id: "ach_highrep30", name: "High-Rep Hero", desc: "Complete 30 reps in a single set of any exercise", icon: "🔁", check: (s) => maxRepsAny(s) >= 30 },
  { id: "ach_highrep60", name: "Rep Titan", desc: "Complete 60 reps in a single set of any exercise", icon: "♾️", check: (s) => maxRepsAny(s) >= 60 },
  { id: "ach_heavy150", name: "Heavy Hitter", desc: "Log 150 kg or more in a single set of any exercise", icon: "🏗️", check: (s) => maxWeightAny(s) >= 150 },
  { id: "ach_heavy200", name: "Two Plates Plus", desc: "Log 200 kg or more in a single set of any exercise", icon: "🏔️", check: (s) => maxWeightAny(s) >= 200 },
];

/* ============================ Diet — data & constants ====================== */
// Diet is an add-on system alongside the workout/program/member system above.
// It reads existing member body data (bodyweightKg/heightCm/age) rather than
// duplicating it — see newMember()/normalizeState() further down, which only
// add the *new* fields Diet needs (sex, activityLevel, weightHistory, food/activity
// logs) onto the same member record.

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: "🌅" },
  { id: "lunch", label: "Lunch", icon: "🍚" },
  { id: "dinner", label: "Dinner", icon: "🌙" },
  { id: "snack", label: "Snack", icon: "🍎" },
];
// Icon choices offered when a member creates their own meal slot — not
// everyone eats on a strict breakfast/lunch/dinner/snack schedule; someone
// doing 5-6 meals a day needs room for "Pre-workout", "Second breakfast", etc.
const MEAL_ICON_CHOICES = ["🍽️", "🥗", "🥪", "🍳", "🥞", "🍲", "🌮", "🍱", "🥤", "🧋", "☕", "🍇", "🍩", "🥛"];
// Builds a brand-new custom meal type. Kept separate from the four fixed
// MEAL_TYPES above (which are never editable/deletable) and stored per-member
// in customMealTypes, since everyone's meal structure differs.
function newMealType({ label, icon }) {
  return { id: uid("meal"), label: label.trim(), icon: icon || MEAL_ICON_CHOICES[0] };
}
// The full list of meal slots to render for a given member: the four fixed
// ones plus whatever they've added themselves.
function mealTypesFor(me) {
  return [...MEAL_TYPES, ...(me?.customMealTypes || [])];
}
const FOOD_CATEGORIES = ["Vietnamese", "Carbs", "Protein", "Dairy", "Fruits", "Vegetables", "Snacks", "Drinks"];
// Every unit the app supports for logging/creating a food (spec §10).
const FOOD_UNITS = ["g", "kg", "ml", "L", "serving", "piece", "slice", "bowl", "cup"];

// Every food stores nutrition per a fixed base quantity (baseAmount + baseUnit).
// Actual calories for a log entry are computed by scaling from that base — see
// computeFoodStats() below — so the user never has to do the math themselves.
// "piece"/"slice"/"serving"/"cup"/"bowl" foods use baseAmount:1 (a count), while
// "g"/"ml" foods can be scaled to any gram/ml amount (and toggled to kg/L).
const FOOD_LIBRARY = [
  // ---- Carbs ----
  { id: "f_rice_white", name: "White rice (cooked)", category: "Carbs", icon: "🍚", baseUnit: "g", baseAmount: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "f_rice_brown", name: "Brown rice (cooked)", category: "Carbs", icon: "🍚", baseUnit: "g", baseAmount: 100, kcal: 112, protein: 2.3, carbs: 24, fat: 0.9 },
  { id: "f_bread_white", name: "White bread", category: "Carbs", icon: "🍞", baseUnit: "slice", baseAmount: 1, kcal: 80, protein: 2.7, carbs: 15, fat: 1 },
  { id: "f_bread_wheat", name: "Whole wheat bread", category: "Carbs", icon: "🍞", baseUnit: "slice", baseAmount: 1, kcal: 70, protein: 3.6, carbs: 12, fat: 1 },
  { id: "f_oats", name: "Oats (dry)", category: "Carbs", icon: "🥣", baseUnit: "g", baseAmount: 100, kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { id: "f_pasta", name: "Pasta (cooked)", category: "Carbs", icon: "🍝", baseUnit: "g", baseAmount: 100, kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { id: "f_potato", name: "Potato (boiled)", category: "Carbs", icon: "🥔", baseUnit: "g", baseAmount: 100, kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "f_sweet_potato", name: "Sweet potato (boiled)", category: "Carbs", icon: "🍠", baseUnit: "g", baseAmount: 100, kcal: 90, protein: 2, carbs: 21, fat: 0.1 },
  { id: "f_noodles_egg", name: "Egg noodles (cooked)", category: "Carbs", icon: "🍜", baseUnit: "g", baseAmount: 100, kcal: 138, protein: 4.5, carbs: 25, fat: 2.1 },
  { id: "f_noodles_rice", name: "Rice noodles / phở (cooked)", category: "Carbs", icon: "🍜", baseUnit: "g", baseAmount: 100, kcal: 109, protein: 0.9, carbs: 25, fat: 0.2 },
  { id: "f_quinoa", name: "Quinoa (cooked)", category: "Carbs", icon: "🌾", baseUnit: "g", baseAmount: 100, kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { id: "f_corn", name: "Corn (boiled)", category: "Carbs", icon: "🌽", baseUnit: "g", baseAmount: 100, kcal: 96, protein: 3.4, carbs: 21, fat: 1.5 },

  // ---- Protein ----
  { id: "f_chicken_breast", name: "Chicken breast (cooked)", category: "Protein", icon: "🍗", baseUnit: "g", baseAmount: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "f_chicken_thigh", name: "Chicken thigh (cooked)", category: "Protein", icon: "🍗", baseUnit: "g", baseAmount: 100, kcal: 209, protein: 26, carbs: 0, fat: 11 },
  { id: "f_beef_lean", name: "Beef, lean (cooked)", category: "Protein", icon: "🥩", baseUnit: "g", baseAmount: 100, kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { id: "f_pork_lean", name: "Pork, lean (cooked)", category: "Protein", icon: "🥩", baseUnit: "g", baseAmount: 100, kcal: 242, protein: 27, carbs: 0, fat: 14 },
  { id: "f_pork_belly", name: "Pork belly (cooked)", category: "Protein", icon: "🥓", baseUnit: "g", baseAmount: 100, kcal: 518, protein: 9, carbs: 0, fat: 53 },
  { id: "f_fish_white", name: "White fish (cooked)", category: "Protein", icon: "🐟", baseUnit: "g", baseAmount: 100, kcal: 128, protein: 26, carbs: 0, fat: 2.7 },
  { id: "f_salmon", name: "Salmon (cooked)", category: "Protein", icon: "🐟", baseUnit: "g", baseAmount: 100, kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "f_tuna_canned", name: "Tuna (canned in water)", category: "Protein", icon: "🐟", baseUnit: "g", baseAmount: 100, kcal: 116, protein: 26, carbs: 0, fat: 0.8 },
  { id: "f_shrimp", name: "Shrimp (cooked)", category: "Protein", icon: "🦐", baseUnit: "g", baseAmount: 100, kcal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { id: "f_egg", name: "Egg, large", category: "Protein", icon: "🥚", baseUnit: "piece", baseAmount: 1, kcal: 70, protein: 6, carbs: 0.4, fat: 5 },
  { id: "f_tofu", name: "Tofu, firm", category: "Protein", icon: "🧊", baseUnit: "g", baseAmount: 100, kcal: 144, protein: 15, carbs: 3, fat: 9 },
  { id: "f_tempeh", name: "Tempeh", category: "Protein", icon: "🧊", baseUnit: "g", baseAmount: 100, kcal: 192, protein: 20, carbs: 7.6, fat: 11 },

  // ---- Dairy ----
  { id: "f_milk_whole", name: "Milk, whole", category: "Dairy", icon: "🥛", baseUnit: "ml", baseAmount: 100, kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { id: "f_milk_skim", name: "Milk, skim", category: "Dairy", icon: "🥛", baseUnit: "ml", baseAmount: 100, kcal: 35, protein: 3.4, carbs: 5, fat: 0.1 },
  { id: "f_yogurt", name: "Yogurt, plain", category: "Dairy", icon: "🍦", baseUnit: "g", baseAmount: 100, kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { id: "f_yogurt_greek", name: "Greek yogurt, plain", category: "Dairy", icon: "🍦", baseUnit: "g", baseAmount: 100, kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { id: "f_cheese_cheddar", name: "Cheese, cheddar", category: "Dairy", icon: "🧀", baseUnit: "g", baseAmount: 100, kcal: 403, protein: 25, carbs: 1.3, fat: 33 },
  { id: "f_cottage_cheese", name: "Cottage cheese", category: "Dairy", icon: "🧀", baseUnit: "g", baseAmount: 100, kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },

  // ---- Fruits ----
  { id: "f_banana", name: "Banana", category: "Fruits", icon: "🍌", baseUnit: "piece", baseAmount: 1, kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "f_apple", name: "Apple", category: "Fruits", icon: "🍎", baseUnit: "piece", baseAmount: 1, kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: "f_orange", name: "Orange", category: "Fruits", icon: "🍊", baseUnit: "piece", baseAmount: 1, kcal: 62, protein: 1.2, carbs: 15, fat: 0.2 },
  { id: "f_mango", name: "Mango", category: "Fruits", icon: "🥭", baseUnit: "g", baseAmount: 100, kcal: 60, protein: 0.8, carbs: 15, fat: 0.4 },
  { id: "f_watermelon", name: "Watermelon", category: "Fruits", icon: "🍉", baseUnit: "g", baseAmount: 100, kcal: 30, protein: 0.6, carbs: 8, fat: 0.2 },
  { id: "f_grapes", name: "Grapes", category: "Fruits", icon: "🍇", baseUnit: "g", baseAmount: 100, kcal: 69, protein: 0.7, carbs: 18, fat: 0.2 },
  { id: "f_pineapple", name: "Pineapple", category: "Fruits", icon: "🍍", baseUnit: "g", baseAmount: 100, kcal: 50, protein: 0.5, carbs: 13, fat: 0.1 },
  { id: "f_dragonfruit", name: "Dragon fruit", category: "Fruits", icon: "🐉", baseUnit: "g", baseAmount: 100, kcal: 60, protein: 1.2, carbs: 13, fat: 0.4 },
  { id: "f_papaya", name: "Papaya", category: "Fruits", icon: "🥭", baseUnit: "g", baseAmount: 100, kcal: 43, protein: 0.5, carbs: 11, fat: 0.3 },

  // ---- Vegetables ----
  { id: "f_broccoli", name: "Broccoli (cooked)", category: "Vegetables", icon: "🥦", baseUnit: "g", baseAmount: 100, kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { id: "f_carrot", name: "Carrot", category: "Vegetables", icon: "🥕", baseUnit: "g", baseAmount: 100, kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { id: "f_spinach", name: "Spinach (cooked)", category: "Vegetables", icon: "🥬", baseUnit: "g", baseAmount: 100, kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { id: "f_cucumber", name: "Cucumber", category: "Vegetables", icon: "🥒", baseUnit: "g", baseAmount: 100, kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { id: "f_tomato", name: "Tomato", category: "Vegetables", icon: "🍅", baseUnit: "g", baseAmount: 100, kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { id: "f_lettuce", name: "Lettuce", category: "Vegetables", icon: "🥬", baseUnit: "g", baseAmount: 100, kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { id: "f_cabbage", name: "Cabbage", category: "Vegetables", icon: "🥬", baseUnit: "g", baseAmount: 100, kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1 },
  { id: "f_water_spinach", name: "Water spinach (rau muống)", category: "Vegetables", icon: "🥬", baseUnit: "g", baseAmount: 100, kcal: 19, protein: 2.6, carbs: 3.1, fat: 0.2 },
  { id: "f_green_beans", name: "Green beans", category: "Vegetables", icon: "🫛", baseUnit: "g", baseAmount: 100, kcal: 31, protein: 1.8, carbs: 7, fat: 0.1 },

  // ---- Snacks ----
  { id: "f_protein_bar", name: "Protein bar", category: "Snacks", icon: "🍫", baseUnit: "piece", baseAmount: 1, kcal: 200, protein: 20, carbs: 22, fat: 7 },
  { id: "f_mixed_nuts", name: "Mixed nuts", category: "Snacks", icon: "🥜", baseUnit: "g", baseAmount: 100, kcal: 607, protein: 20, carbs: 21, fat: 54 },
  { id: "f_chocolate_dark", name: "Dark chocolate", category: "Snacks", icon: "🍫", baseUnit: "g", baseAmount: 100, kcal: 546, protein: 7.8, carbs: 46, fat: 31 },
  { id: "f_chips", name: "Potato chips", category: "Snacks", icon: "🍟", baseUnit: "g", baseAmount: 100, kcal: 536, protein: 7, carbs: 53, fat: 35 },
  { id: "f_popcorn", name: "Popcorn (air-popped)", category: "Snacks", icon: "🍿", baseUnit: "g", baseAmount: 100, kcal: 387, protein: 13, carbs: 78, fat: 4.5 },
  { id: "f_instant_noodles", name: "Instant noodles (1 pack)", category: "Snacks", icon: "🍜", baseUnit: "serving", baseAmount: 1, kcal: 380, protein: 7, carbs: 51, fat: 17 },

  // ---- Drinks ----
  { id: "f_coffee_black", name: "Coffee, black", category: "Drinks", icon: "☕", baseUnit: "cup", baseAmount: 1, kcal: 2, protein: 0.3, carbs: 0, fat: 0 },
  { id: "f_coffee_milk_sugar", name: "Coffee with milk & sugar (cà phê sữa)", category: "Drinks", icon: "☕", baseUnit: "cup", baseAmount: 1, kcal: 120, protein: 3, carbs: 18, fat: 4 },
  { id: "f_soft_drink", name: "Soft drink / soda", category: "Drinks", icon: "🥤", baseUnit: "ml", baseAmount: 100, kcal: 42, protein: 0, carbs: 10.6, fat: 0 },
  { id: "f_orange_juice", name: "Orange juice", category: "Drinks", icon: "🧃", baseUnit: "ml", baseAmount: 100, kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2 },
  { id: "f_beer", name: "Beer", category: "Drinks", icon: "🍺", baseUnit: "ml", baseAmount: 100, kcal: 43, protein: 0.5, carbs: 3.6, fat: 0 },
  { id: "f_bubble_tea", name: "Bubble tea", category: "Drinks", icon: "🧋", baseUnit: "cup", baseAmount: 1, kcal: 350, protein: 2, carbs: 60, fat: 10 },
  { id: "f_coconut_water", name: "Coconut water", category: "Drinks", icon: "🥥", baseUnit: "ml", baseAmount: 100, kcal: 19, protein: 0.2, carbs: 3.7, fat: 0.2 },

  // ============================================================================
  // ---- Vietnamese — common everyday dishes (spec addition: full local menu) ----
  // Composite home-cooked and street-food dishes, grouped as their own category
  // since each is a mixed meal (carb+protein+veg together) rather than a single
  // ingredient like the sections above. Nutrition is estimated for a typical
  // single serving as eaten, not per 100g, since that's how these are ordered.
  // ============================================================================

  // -- Noodle soups (phở, bún, hủ tiếu, cháo…) --
  { id: "f_vn_pho_bo", name: "Phở bò (beef noodle soup)", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 450, protein: 25, carbs: 60, fat: 10 },
  { id: "f_vn_pho_ga", name: "Phở gà (chicken noodle soup)", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 400, protein: 24, carbs: 55, fat: 7 },
  { id: "f_vn_bun_bo_hue", name: "Bún bò Huế", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 470, protein: 24, carbs: 55, fat: 16 },
  { id: "f_vn_bun_rieu", name: "Bún riêu (crab & tomato noodle soup)", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 380, protein: 18, carbs: 50, fat: 12 },
  { id: "f_vn_hu_tieu", name: "Hủ tiếu", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 420, protein: 20, carbs: 55, fat: 12 },
  { id: "f_vn_mi_quang", name: "Mì Quảng", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 460, protein: 22, carbs: 55, fat: 16 },
  { id: "f_vn_banh_canh", name: "Bánh canh giò heo", category: "Vietnamese", icon: "🍲", baseUnit: "bowl", baseAmount: 1, kcal: 480, protein: 20, carbs: 60, fat: 16 },
  { id: "f_vn_chao_ga", name: "Cháo gà (chicken rice porridge)", category: "Vietnamese", icon: "🥣", baseUnit: "bowl", baseAmount: 1, kcal: 260, protein: 15, carbs: 35, fat: 6 },
  { id: "f_vn_chao_long", name: "Cháo lòng (pork organ porridge)", category: "Vietnamese", icon: "🥣", baseUnit: "bowl", baseAmount: 1, kcal: 350, protein: 18, carbs: 35, fat: 14 },

  // -- Bánh mì, xôi & other savory breakfasts --
  { id: "f_vn_banh_mi_thit", name: "Bánh mì thịt", category: "Vietnamese", icon: "🥖", baseUnit: "piece", baseAmount: 1, kcal: 450, protein: 18, carbs: 48, fat: 20 },
  { id: "f_vn_banh_mi_trung", name: "Bánh mì ốp la (egg bánh mì)", category: "Vietnamese", icon: "🥖", baseUnit: "piece", baseAmount: 1, kcal: 350, protein: 14, carbs: 42, fat: 14 },
  { id: "f_vn_xoi_man", name: "Xôi mặn (savory sticky rice)", category: "Vietnamese", icon: "🍚", baseUnit: "bowl", baseAmount: 1, kcal: 450, protein: 15, carbs: 65, fat: 14 },
  { id: "f_vn_xoi_xeo", name: "Xôi xéo (mung bean sticky rice)", category: "Vietnamese", icon: "🍚", baseUnit: "bowl", baseAmount: 1, kcal: 420, protein: 10, carbs: 70, fat: 12 },
  { id: "f_vn_banh_cuon", name: "Bánh cuốn", category: "Vietnamese", icon: "🥟", baseUnit: "serving", baseAmount: 1, kcal: 300, protein: 10, carbs: 45, fat: 8 },
  { id: "f_vn_banh_gio", name: "Bánh giò", category: "Vietnamese", icon: "🥟", baseUnit: "piece", baseAmount: 1, kcal: 250, protein: 6, carbs: 40, fat: 7 },

  // -- Rice plates & family-meal mains --
  { id: "f_vn_com_tam", name: "Cơm tấm sườn bì chả", category: "Vietnamese", icon: "🍚", baseUnit: "serving", baseAmount: 1, kcal: 750, protein: 35, carbs: 90, fat: 28 },
  { id: "f_vn_com_ga", name: "Cơm gà (chicken rice)", category: "Vietnamese", icon: "🍚", baseUnit: "serving", baseAmount: 1, kcal: 550, protein: 28, carbs: 70, fat: 18 },
  { id: "f_vn_com_suon", name: "Cơm sườn nướng", category: "Vietnamese", icon: "🍚", baseUnit: "serving", baseAmount: 1, kcal: 650, protein: 30, carbs: 75, fat: 24 },
  { id: "f_vn_com_chien", name: "Cơm chiên (fried rice)", category: "Vietnamese", icon: "🍚", baseUnit: "bowl", baseAmount: 1, kcal: 450, protein: 12, carbs: 60, fat: 16 },
  { id: "f_vn_thit_kho", name: "Thịt kho tàu (braised pork & egg)", category: "Vietnamese", icon: "🍖", baseUnit: "serving", baseAmount: 1, kcal: 400, protein: 22, carbs: 8, fat: 30 },
  { id: "f_vn_ca_kho", name: "Cá kho tộ (caramelized braised fish)", category: "Vietnamese", icon: "🐟", baseUnit: "serving", baseAmount: 1, kcal: 300, protein: 25, carbs: 8, fat: 18 },
  { id: "f_vn_ga_kho_gung", name: "Gà kho gừng (ginger braised chicken)", category: "Vietnamese", icon: "🍗", baseUnit: "serving", baseAmount: 1, kcal: 320, protein: 26, carbs: 6, fat: 20 },
  { id: "f_vn_ga_luoc", name: "Gà luộc (boiled chicken)", category: "Vietnamese", icon: "🍗", baseUnit: "serving", baseAmount: 1, kcal: 220, protein: 27, carbs: 0, fat: 12 },
  { id: "f_vn_canh_chua", name: "Canh chua cá (sweet & sour fish soup)", category: "Vietnamese", icon: "🍲", baseUnit: "bowl", baseAmount: 1, kcal: 180, protein: 14, carbs: 14, fat: 8 },
  { id: "f_vn_canh_rau", name: "Canh rau (vegetable soup)", category: "Vietnamese", icon: "🍲", baseUnit: "bowl", baseAmount: 1, kcal: 80, protein: 4, carbs: 10, fat: 2.5 },
  { id: "f_vn_rau_muong_xao", name: "Rau muống xào tỏi", category: "Vietnamese", icon: "🥬", baseUnit: "serving", baseAmount: 1, kcal: 120, protein: 4, carbs: 8, fat: 8 },
  { id: "f_vn_dau_hu_sot_ca", name: "Đậu hũ sốt cà chua", category: "Vietnamese", icon: "🍅", baseUnit: "serving", baseAmount: 1, kcal: 180, protein: 9, carbs: 10, fat: 11 },
  { id: "f_vn_trung_chien", name: "Trứng chiên (Vietnamese fried omelet)", category: "Vietnamese", icon: "🍳", baseUnit: "serving", baseAmount: 1, kcal: 200, protein: 12, carbs: 2, fat: 16 },
  { id: "f_vn_cha_lua", name: "Chả lụa (pork sausage)", category: "Vietnamese", icon: "🥓", baseUnit: "g", baseAmount: 100, kcal: 150, protein: 15, carbs: 3, fat: 9 },

  // -- Noodles & street food --
  { id: "f_vn_bun_cha", name: "Bún chả Hà Nội", category: "Vietnamese", icon: "🍢", baseUnit: "serving", baseAmount: 1, kcal: 600, protein: 30, carbs: 65, fat: 24 },
  { id: "f_vn_bun_thit_nuong", name: "Bún thịt nướng", category: "Vietnamese", icon: "🍜", baseUnit: "bowl", baseAmount: 1, kcal: 520, protein: 26, carbs: 60, fat: 18 },
  { id: "f_vn_goi_cuon", name: "Gỏi cuốn (fresh spring roll)", category: "Vietnamese", icon: "🥢", baseUnit: "piece", baseAmount: 1, kcal: 75, protein: 5, carbs: 10, fat: 2 },
  { id: "f_vn_cha_gio", name: "Chả giò / nem rán (fried spring roll)", category: "Vietnamese", icon: "🥟", baseUnit: "piece", baseAmount: 1, kcal: 80, protein: 3, carbs: 6, fat: 5 },
  { id: "f_vn_banh_xeo", name: "Bánh xèo", category: "Vietnamese", icon: "🥞", baseUnit: "serving", baseAmount: 1, kcal: 350, protein: 12, carbs: 35, fat: 18 },
  { id: "f_vn_banh_khot", name: "Bánh khọt", category: "Vietnamese", icon: "🥞", baseUnit: "serving", baseAmount: 1, kcal: 350, protein: 10, carbs: 40, fat: 16 },
  { id: "f_vn_banh_bao", name: "Bánh bao", category: "Vietnamese", icon: "🥟", baseUnit: "piece", baseAmount: 1, kcal: 250, protein: 9, carbs: 35, fat: 8 },
  { id: "f_vn_nem_nuong", name: "Nem nướng (grilled pork skewers)", category: "Vietnamese", icon: "🍢", baseUnit: "serving", baseAmount: 1, kcal: 280, protein: 20, carbs: 12, fat: 17 },
  { id: "f_vn_banh_trang_tron", name: "Bánh tráng trộn (rice paper salad)", category: "Vietnamese", icon: "🌶️", baseUnit: "serving", baseAmount: 1, kcal: 300, protein: 8, carbs: 38, fat: 13 },
  { id: "f_vn_hot_vit_lon", name: "Trứng vịt lộn (balut)", category: "Vietnamese", icon: "🥚", baseUnit: "piece", baseAmount: 1, kcal: 180, protein: 13, carbs: 4, fat: 12 },

  // -- Desserts & sweet snacks --
  { id: "f_vn_che_dau_xanh", name: "Chè đậu xanh (mung bean sweet soup)", category: "Vietnamese", icon: "🍮", baseUnit: "bowl", baseAmount: 1, kcal: 200, protein: 6, carbs: 38, fat: 3 },
  { id: "f_vn_che_ba_mau", name: "Chè ba màu (three-color dessert)", category: "Vietnamese", icon: "🍮", baseUnit: "bowl", baseAmount: 1, kcal: 250, protein: 4, carbs: 48, fat: 5 },
  { id: "f_vn_banh_flan", name: "Bánh flan (Vietnamese crème caramel)", category: "Vietnamese", icon: "🍮", baseUnit: "piece", baseAmount: 1, kcal: 150, protein: 4, carbs: 22, fat: 6 },
  { id: "f_vn_banh_chung", name: "Bánh chưng", category: "Vietnamese", icon: "🍙", baseUnit: "slice", baseAmount: 1, kcal: 200, protein: 5, carbs: 32, fat: 6 },
  { id: "f_vn_sua_chua_nep_cam", name: "Sữa chua nếp cẩm (yogurt with black sticky rice)", category: "Vietnamese", icon: "🍨", baseUnit: "bowl", baseAmount: 1, kcal: 250, protein: 7, carbs: 42, fat: 6 },

  // -- Everyday drinks --
  { id: "f_vn_tra_da", name: "Trà đá (iced tea)", category: "Vietnamese", icon: "🧊", baseUnit: "cup", baseAmount: 1, kcal: 5, protein: 0, carbs: 1, fat: 0 },
  { id: "f_vn_nuoc_mia", name: "Nước mía (sugarcane juice)", category: "Vietnamese", icon: "🥤", baseUnit: "cup", baseAmount: 1, kcal: 180, protein: 0, carbs: 45, fat: 0 },
  { id: "f_vn_sinh_to_bo", name: "Sinh tố bơ (avocado smoothie)", category: "Vietnamese", icon: "🥑", baseUnit: "cup", baseAmount: 1, kcal: 350, protein: 5, carbs: 35, fat: 22 },
  { id: "f_vn_nuoc_chanh", name: "Nước chanh (lime juice)", category: "Vietnamese", icon: "🍋", baseUnit: "cup", baseAmount: 1, kcal: 60, protein: 0, carbs: 15, fat: 0 },
  { id: "f_vn_sua_dau_nanh", name: "Sữa đậu nành (soy milk)", category: "Vietnamese", icon: "🥛", baseUnit: "cup", baseAmount: 1, kcal: 130, protein: 7, carbs: 14, fat: 5 },
];

// "Estimate a meal" mode for restaurant/eating-out food, per spec — these are
// intentionally ranges, never a false-precision single number. Anything the
// user types that doesn't match falls back to a fully manual estimate.
const RESTAURANT_ESTIMATES = [
  { id: "r_pho", name: "Phở (bowl)", kcalLow: 350, kcalHigh: 500 },
  { id: "r_bun_cha", name: "Bún chả", kcalLow: 600, kcalHigh: 750 },
  { id: "r_com_tam", name: "Cơm tấm sườn", kcalLow: 650, kcalHigh: 850 },
  { id: "r_banh_mi", name: "Bánh mì", kcalLow: 350, kcalHigh: 550 },
  { id: "r_bun_bo_hue", name: "Bún bò Huế", kcalLow: 450, kcalHigh: 650 },
  { id: "r_goi_cuon", name: "Gỏi cuốn (2 rolls)", kcalLow: 150, kcalHigh: 250 },
  { id: "r_chicken_rice", name: "Chicken rice (cơm gà)", kcalLow: 500, kcalHigh: 700 },
  { id: "r_fried_rice", name: "Fried rice", kcalLow: 500, kcalHigh: 700 },
  { id: "r_noodle_soup", name: "Noodle soup (general)", kcalLow: 350, kcalHigh: 550 },
  { id: "r_burger_fries", name: "Burger + fries", kcalLow: 650, kcalHigh: 900 },
  { id: "r_pizza_slice", name: "Pizza (1 slice)", kcalLow: 250, kcalHigh: 400 },
  { id: "r_salad_protein", name: "Salad bowl with protein", kcalLow: 350, kcalHigh: 550 },
];

/* -------------------------------- Utils --------------------------------- */
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDaysISO(iso, delta) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayKeyForISO(iso) {
  return DAY_FROM_JS[isoToDate(iso).getDay()];
}
function todayDayKey() {
  return dayKeyForISO(todayISO());
}
function formatNiceDate(iso) {
  return isoToDate(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function formatShortDate(iso) {
  return isoToDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function pickDaily(seedName, list) {
  const idx = hashStr(seedName + todayISO()) % list.length;
  return list[idx];
}
function levelInfo(xp) {
  const XP_PER_LEVEL = 300;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, need: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}
function volumeOf(sets, reps, weight) {
  return Math.round((Number(sets) || 0) * (Number(reps) || 0) * (Number(weight) || 0));
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
export function emptyWeek() {
  const days = {};
  DAY_ORDER.forEach((d) => (days[d] = { type: "rest", exercises: [] }));
  return days;
}
export function newMember({ id, name, role, status, avatarUrl }) {
  return {
    id: id || uid("mem"),
    name,
    avatar: AVATAR_SWATCHES[hashStr(name) % AVATAR_SWATCHES.length],
    avatarUrl: avatarUrl || null,
    role,
    status,
    goal: "hybrid",
    bodyweightKg: DEFAULT_BODYWEIGHT_KG,
    heightCm: DEFAULT_HEIGHT_CM,
    age: DEFAULT_AGE,
    joinedAt: todayISO(),
    activeProgramId: null,
    xp: 0,
    streak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    totalVolume: 0,
    totalWorkouts: 0,
    prCount: 0,
    unlocked: [],
    history: {},      // { [exerciseId]: [{date, sets, reps, weight, volume}] }
    worklogs: {},      // { [iso]: { restDay:bool, exercises: {[exerciseId]:{sets,reps,weight,done}}, completedAt } }
    exerciseNotes: {}, // { [exerciseId]: text }
    // ---- Diet add-on fields (extend this same member record, no second object) ----
    sex: DEFAULT_SEX,
    activityLevel: DEFAULT_ACTIVITY_LEVEL,
    dietGoal: DEFAULT_DIET_GOAL,
    weightHistory: [],        // [{date, kg}] — bodyweightKg above always mirrors the latest entry
    calorieTargetOverride: null,
    proteinTargetOverride: null,
    foodLog: {},              // { [iso]: [ {id, meal, source, foodId, name, amount, unit, kcal, protein, carbs, fat, note} ] }
    activityLog: {},          // { [iso]: { steps, workoutMinutes } } — workout *completion* itself still comes from worklogs
    customMealTypes: [],      // [ {id, label, icon} ] — meal slots this member added beyond breakfast/lunch/dinner/snack
  };
}
function recomputeAchievements(m) {
  const unlockedNow = new Set(m.unlocked || []);
  ACHIEVEMENTS.forEach((a) => {
    if (a.check(m)) unlockedNow.add(a.id);
  });
  return Array.from(unlockedNow);
}
// Compute a member's current/longest streak from scratch, based on which
// dates have a fully-completed worklog and the active program's weekly
// schedule — rather than incrementally bumping a counter only at the moment
// "today" gets marked complete. That incremental approach couldn't handle
// backfilling: if someone forgets to log Tuesday's workout and only fills it
// in on Wednesday (from the calendar's Day Detail page), the streak needs to
// treat Tuesday as done retroactively, which a one-way "today only" counter
// can never do. Recomputing from the full worklog history on every edit
// (today's flow or a past-date edit) keeps the streak correct no matter
// when or where a session gets logged, edited, or un-logged.
//
// A date only needs a completed log to keep the streak alive if it was a
// scheduled workout day; scheduled rest days (or days with no schedule at
// all when no program is active) pass through for free, exactly like the
// old logic did.
function recomputeStreak(m, program) {
  const worklogs = m.worklogs || {};
  const completedDates = Object.keys(worklogs).filter((iso) => worklogs[iso]?.completedAt).sort();
  if (completedDates.length === 0) {
    return { streak: 0, longestStreak: m.longestStreak || 0, lastActiveDate: null };
  }
  const today = todayISO();
  // "As of" date for the current streak: today if already completed, else
  // yesterday — so an unfinished-but-not-yet-missed today doesn't zero out
  // an otherwise-intact streak before the day is even over.
  const endDate = completedDates.includes(today) ? today : addDaysISO(today, -1);
  const firstDate = completedDates[0];
  const mustLogDay = (iso) => {
    if (!program) return true; // no active program: every day counts, so any gap breaks the streak
    const sched = program.days?.[dayKeyForISO(iso)];
    return !sched || sched.type === "workout";
  };
  let running = 0;
  let longest = 0;
  if (endDate >= firstDate) {
    let cursor = firstDate;
    let guard = 0;
    while (cursor <= endDate && guard < 3660 * 3) {
      if (worklogs[cursor]?.completedAt) running += 1;
      else if (mustLogDay(cursor)) running = 0;
      if (running > longest) longest = running;
      cursor = addDaysISO(cursor, 1);
      guard++;
    }
  }
  return {
    streak: running,
    longestStreak: Math.max(m.longestStreak || 0, longest),
    lastActiveDate: completedDates[completedDates.length - 1],
  };
}
export function applyStreak(m, program) {
  const { streak, longestStreak, lastActiveDate } = recomputeStreak(m, program);
  return { ...m, streak, longestStreak, lastActiveDate };
}

// Self-heal every member's stored streak against the source-of-truth worklog
// history whenever state is loaded. Streak fields are only recomputed inside
// the mutation handlers (completing/editing/clearing a worklog) — so any
// value written before the recompute fix existed, or by some future code
// path that forgets to call applyStreak, would otherwise sit there stale
// forever until that member's next edit. Running this on load means a
// backfilled session (or any other stored inconsistency) gets corrected the
// moment the app opens, without requiring a fresh edit to trigger it.
function healMemberStreaks(state) {
  if (!state?.members) return state;
  let changed = false;
  const members = { ...state.members };
  Object.keys(members).forEach((id) => {
    const m = members[id];
    const program = m.activeProgramId ? state.programs?.[m.activeProgramId] : null;
    const healed = applyStreak(m, program);
    if (healed.streak !== m.streak || healed.longestStreak !== m.longestStreak || healed.lastActiveDate !== m.lastActiveDate) {
      members[id] = healed;
      changed = true;
    }
  });
  return changed ? { ...state, members } : state;
}

// Emails in this list are always treated as admin — both for a brand-new
// member record on first login, and to auto-upgrade an existing record that
// was created before the email was added here (e.g. it originally signed in
// as a regular "member").
const ADMIN_EMAILS = ["buihuyhoang181001@gmail.com"];

/* ---------------------------- Storage helpers ---------------------------- */
const STATE_KEY = "KBL_state_v1";
function normalizeState(s) {
  if (!s) return s;
  const members = Object.fromEntries(
    Object.entries(s.members || {}).map(([id, m]) => [id, {
      bodyweightKg: DEFAULT_BODYWEIGHT_KG, heightCm: DEFAULT_HEIGHT_CM, age: DEFAULT_AGE, avatarUrl: null,
      sex: DEFAULT_SEX, activityLevel: DEFAULT_ACTIVITY_LEVEL, dietGoal: DEFAULT_DIET_GOAL, weightHistory: [], calorieTargetOverride: null,
      proteinTargetOverride: null,
      foodLog: {}, activityLog: {}, customMealTypes: [],
      ...m,
    }])
  );
  return { ...s, members, customExercises: s.customExercises || {}, customFoods: s.customFoods || {}, programs: s.programs || {} };
}
// Shared app state lives in a single JSONB row (id=1) in the `app_state` table.
// Per-user photo galleries live one-row-per-user in `user_photos`, keyed by the
// Supabase auth user id. RLS policies (see supabase/schema.sql) restrict writes
// to authenticated users.
// Returns { data, failed }. This distinguishes "the row genuinely doesn't
// exist yet" (data: null, failed: false — true first run) from "the read
// itself failed" (data: null, failed: true — e.g. RLS rejecting a read that
// happens before/without a valid auth session, such as during a wrong or
// not-yet-settled login). Callers must NOT treat failed:true as "first run":
// doing so previously caused a failed read to trigger creation of an empty
// state that got saved over the real shared row, wiping everyone's data.
async function storageLoadState() {
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return { data: data ? normalizeState(data.data) : null, failed: false };
  } catch (e) {
    console.error("storageLoadState failed", e);
    return { data: null, failed: true };
  }
}
async function storageSaveState(state) {
  try {
    const { error } = await supabase
      .from("app_state")
      .upsert({ id: 1, data: state, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("storageSaveState failed", e);
    return false;
  }
}
async function storageLoadPhotos(userId) {
  try {
    const { data, error } = await supabase
      .from("user_photos")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.data : [];
  } catch (e) {
    console.error("storageLoadPhotos failed", e);
    return [];
  }
}
async function storageSavePhotos(userId, photos) {
  try {
    const { error } = await supabase
      .from("user_photos")
      .upsert({ user_id: userId, data: photos, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("storageSavePhotos failed", e);
    return false;
  }
}

/* ---------------------------- Initial app state --------------------------- */
// IMPORTANT: this must start with zero members. The bootstrap rule ("the very
// first person to sign in becomes admin") only works if the store is truly
// empty on first run — pre-seeding fake members here would permanently steal
// the admin slot from whoever actually deploys this for their crew.
function emptyAppState() {
  return { members: {}, programs: {}, customExercises: {}, customFoods: {}, createdAt: todayISO() };
}

/* ================================ Diet — logic ============================= */
// All of this reads/writes the SAME member record as the rest of the app
// (state.members[id]) — there is no second, parallel "diet user" object.

function activityLevelInfo(id) {
  return ACTIVITY_LEVELS.find((a) => a.id === id) || ACTIVITY_LEVELS.find((a) => a.id === DEFAULT_ACTIVITY_LEVEL);
}
// Rounds to one decimal place — used for macro grams (protein/carbs/fat) and
// weight deltas, where the old shared helper (now roundHalf, see Primitives)
// snapped to the nearest 0.5 instead. That was fine for a bodyweight +/-
// stepper but silently mangled anything finer: a true 0.3kg weight change
// displayed as "0.5kg", and 26.3g of protein displayed as "26.5g".
function round1(n) { return Math.round(n * 10) / 10; }
// Mifflin-St Jeor — the standard, widely-used estimate. Like any BMR formula,
// this is an estimate, not a medical measurement (see calorieTargetFor below).
function calcBMR({ sex, weightKg, heightCm, age }) {
  const w = Number(weightKg) || DEFAULT_BODYWEIGHT_KG;
  const h = Number(heightCm) || DEFAULT_HEIGHT_CM;
  const a = Number(age) || DEFAULT_AGE;
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(sex === "female" ? base - 161 : base + 5);
}
function calcTDEE(bmr, activityLevel) {
  return Math.round(bmr * activityLevelInfo(activityLevel).mult);
}
// The member's current weight is simply the most recent entry in their weight
// history (weightHistory is kept sorted ascending by date — see upsertWeightEntry).
// Falls back to bodyweightKg for members who haven't logged a dated weight yet,
// so this never regresses behavior for the existing bodyweight field.
function currentWeightKg(member) {
  const hist = member?.weightHistory || [];
  if (hist.length === 0) return member?.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  return hist[hist.length - 1].kg;
}
// For a past date, "weight that day" is the most recent logged entry on or
// before that date (falling back to the earliest entry, then current weight)
// — so browsing history shows what was true then, not today's number.
function weightOnDate(member, iso) {
  const hist = member?.weightHistory || [];
  if (hist.length === 0) return member?.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG;
  const onOrBefore = [...hist].filter((h) => h.date <= iso).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return onOrBefore ? onOrBefore.kg : hist[0].kg;
}
// A manual override always wins (spec §13) but is otherwise derived live from
// body data — so changing weight/height/age/activity level updates the target
// automatically, with no separate value to keep in sync.
function calorieTargetFor(member) {
  if (member?.calorieTargetOverride != null) return Math.round(member.calorieTargetOverride);
  const bmr = calcBMR({
    sex: member?.sex || DEFAULT_SEX,
    weightKg: currentWeightKg(member),
    heightCm: member?.heightCm ?? DEFAULT_HEIGHT_CM,
    age: member?.age ?? DEFAULT_AGE,
  });
  const tdee = calcTDEE(bmr, member?.activityLevel || DEFAULT_ACTIVITY_LEVEL);
  const pct = dietGoalInfo(member?.dietGoal).kcalPct;
  return Math.round(tdee * (1 + pct));
}
// Suggested macro split, derived the exact same way the calorie target is —
// never stored, always recomputed live from current body data + calorie
// target, so it stays in sync with weight/activity/override automatically
// like everything else in this file. Protein is anchored to bodyweight (a
// widely-used strength/physique coaching guideline — see calcBMR's comment
// for the same "estimate, not a lab measurement" caveat) unless the member
// has set a manual proteinTargetOverride (spec-alike to calorieTargetOverride
// — see calorieTargetFor above), in which case that always wins. Fat gets a
// fixed share of total calories, and carbs take the remainder. This is the
// same three-step approach most calorie-tracking apps use once total
// calories (and protein) are already known — nothing here is stored on the
// member record except the optional override itself.
function macroTargetsFor(member) {
  const kcalTarget = calorieTargetFor(member);
  const weightKg = currentWeightKg(member);
  const proteinPerKg = dietGoalInfo(member?.dietGoal).proteinPerKg;
  const proteinG = member?.proteinTargetOverride != null
    ? Math.round(member.proteinTargetOverride)
    : Math.round((Number(weightKg) || DEFAULT_BODYWEIGHT_KG) * proteinPerKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = kcalTarget * 0.25;
  const fatG = Math.round(fatKcal / 9);
  const carbsG = Math.max(0, Math.round((kcalTarget - proteinKcal - fatKcal) / 4));
  return { proteinG, carbsG, fatG };
}
// One dated entry per day — logging a new weight for a date that's already
// logged corrects that day rather than creating a duplicate history row.
function upsertWeightEntry(history, iso, kg) {
  const list = (history || []).filter((h) => h.date !== iso);
  list.push({ date: iso, kg: Math.round(Number(kg) * 10) / 10 });
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return list;
}
function allFoods(customFoods = {}) {
  return [...FOOD_LIBRARY, ...Object.values(customFoods)];
}
function getFood(id, customFoods = {}) {
  return customFoods[id] || FOOD_LIBRARY.find((f) => f.id === id) || null;
}
// g<->kg and ml<->L are the only unit conversions; every other baseUnit
// (piece/slice/serving/cup/bowl) is a plain count with no conversion.
function foodUnitChoices(food) {
  if (!food) return ["g"];
  if (food.baseUnit === "g") return ["g", "kg"];
  if (food.baseUnit === "ml") return ["ml", "L"];
  return [food.baseUnit];
}
function toBaseUnitAmount(food, amount, unit) {
  const amt = Number(amount) || 0;
  if (!food || unit === food.baseUnit) return amt;
  if (food.baseUnit === "g" && unit === "kg") return amt * 1000;
  if (food.baseUnit === "ml" && unit === "L") return amt * 1000;
  return amt;
}
// The single place calories-from-a-database-food get computed, so the user
// never has to do the arithmetic (spec §8/§9).
function computeFoodStats(food, amount, unit) {
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const baseAmt = toBaseUnitAmount(food, amount, unit || food.baseUnit);
  const factor = food.baseAmount ? baseAmt / food.baseAmount : 0;
  return {
    kcal: Math.round((food.kcal || 0) * factor),
    protein: round1((food.protein || 0) * factor),
    carbs: round1((food.carbs || 0) * factor),
    fat: round1((food.fat || 0) * factor),
  };
}
function newCustomFood({ name, category, icon, baseUnit, baseAmount, kcal, protein, carbs, fat, createdBy }) {
  return {
    id: uid("food"), custom: true, createdBy,
    name: (name || "").trim() || "Custom food",
    category: category || "Snacks",
    icon: icon || "🍽️",
    baseUnit: baseUnit || "g",
    baseAmount: Number(baseAmount) || 100,
    kcal: Number(kcal) || 0,
    protein: Number(protein) || 0,
    carbs: Number(carbs) || 0,
    fat: Number(fat) || 0,
  };
}
function newFoodEntry({ meal, source, foodId, name, amount, unit, kcal, protein, carbs, fat, note }) {
  return {
    id: uid("fe"),
    meal: meal || "snack",
    source: source || "database", // "database" | "estimate" | "manual"
    foodId: foodId || null,
    name: name || "",
    amount: Number(amount) || 0,
    unit: unit || "g",
    kcal: Math.round(Number(kcal) || 0),
    protein: protein != null ? round1(Number(protein)) : null,
    carbs: carbs != null ? round1(Number(carbs)) : null,
    fat: fat != null ? round1(Number(fat)) : null,
    note: note || "",
  };
}
// Steps + logged workout minutes for a date; workout *completion* itself is
// never duplicated here — see workoutSummaryForDay() below, which reads the
// existing worklogs directly.
function activityForDay(member, iso) {
  return member?.activityLog?.[iso] || { steps: 0, workoutMinutes: 0 };
}
// Derives "was a workout done, and roughly how long" from the existing worklog
// system (spec §16/§22) — this is the single source of truth for workout
// completion; Diet only adds an optional, explicitly-logged duration on top.
function workoutSummaryForDay(member, iso) {
  const wl = member?.worklogs?.[iso];
  const completed = !!wl?.completedAt;
  const loggedExercises = Object.values(wl?.exercises || {}).filter((e) => e.done).length;
  const manualMinutes = member?.activityLog?.[iso]?.workoutMinutes || 0;
  return { completed, loggedExercises, minutes: manualMinutes };
}
function foodEntriesForDay(member, iso) {
  return member?.foodLog?.[iso] || [];
}
function totalKcalForDay(member, iso) {
  return foodEntriesForDay(member, iso).reduce((sum, e) => sum + (Number(e.kcal) || 0), 0);
}
function macrosForDay(member, iso) {
  return foodEntriesForDay(member, iso).reduce(
    (m, e) => ({ protein: m.protein + (e.protein || 0), carbs: m.carbs + (e.carbs || 0), fat: m.fat + (e.fat || 0) }),
    { protein: 0, carbs: 0, fat: 0 }
  );
}
// A light, clearly-labeled estimate of calories burned by logged activity —
// never presented as exact (spec §17/§30).
function estimatedActivityKcal(member, iso) {
  const { steps, workoutMinutes } = activityForDay(member, iso);
  const stepsKcal = (Number(steps) || 0) * 0.04; // ≈ walking energy cost per step, rough estimate
  const workoutKcal = (Number(workoutMinutes) || 0) * 6; // ≈ moderate resistance training, rough estimate
  return Math.round(stepsKcal + workoutKcal);
}
// Quick-add defaults to whichever meal makes sense right now, so the common
// case (logging what you just ate) needs zero extra taps.
function defaultMealForNow() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
function datesInRange(startISO, endISO) {
  const out = [];
  let d = startISO, guard = 0;
  while (d <= endISO && guard < 400) { out.push(d); d = addDaysISO(d, 1); guard++; }
  return out;
}
// Weekly/monthly rollups (spec §18) — every number here is derived live from
// foodLog/activityLog/weightHistory, never stored separately, so editing a
// single day's food always updates these on the next render for free.
// Averages are per LOGGED day, not per calendar day, for every metric here —
// previously avgKcal divided by days-with-food while avgSteps/avgMinutes
// divided by the full date range, so a week with food logged on only 2 days
// showed a misleadingly "clean" avgKcal (just those 2 days) next to an
// avgSteps dragged down by the 5 unlogged zero-step days. Averaging all three
// the same way keeps them comparable, and the day counts let the UI say
// exactly how many days each average is based on instead of implying full
// coverage.
function dietStatsForRange(member, startISO, endISO) {
  const dates = datesInRange(startISO, endISO);
  const kcalPerDay = dates.map((d) => totalKcalForDay(member, d));
  const stepsPerDay = dates.map((d) => activityForDay(member, d).steps || 0);
  const minutesPerDay = dates.map((d) => workoutSummaryForDay(member, d).minutes || 0);
  const macrosPerDay = dates.map((d) => macrosForDay(member, d));
  const daysWithFood = kcalPerDay.filter((k) => k > 0).length;
  const daysWithSteps = stepsPerDay.filter((s) => s > 0).length;
  const daysWithMinutes = minutesPerDay.filter((m) => m > 0).length;
  const totalKcal = kcalPerDay.reduce((a, b) => a + b, 0);
  const totalSteps = stepsPerDay.reduce((a, b) => a + b, 0);
  const totalMinutes = minutesPerDay.reduce((a, b) => a + b, 0);
  const proteinPerDay = macrosPerDay.map((d) => round1(d.protein));
  const totalMacros = macrosPerDay.reduce(
    (m, d) => ({ protein: m.protein + d.protein, carbs: m.carbs + d.carbs, fat: m.fat + d.fat }),
    { protein: 0, carbs: 0, fat: 0 }
  );
  const daysWithProtein = proteinPerDay.filter((p) => p > 0).length;
  const weightChange = round1(weightOnDate(member, endISO) - weightOnDate(member, startISO));
  return {
    avgKcal: daysWithFood ? Math.round(totalKcal / daysWithFood) : 0,
    totalKcal,
    avgSteps: daysWithSteps ? Math.round(totalSteps / daysWithSteps) : 0,
    avgMinutes: daysWithMinutes ? Math.round(totalMinutes / daysWithMinutes) : 0,
    avgMacros: daysWithFood
      ? { protein: Math.round(totalMacros.protein / daysWithFood), carbs: Math.round(totalMacros.carbs / daysWithFood), fat: Math.round(totalMacros.fat / daysWithFood) }
      : { protein: 0, carbs: 0, fat: 0 },
    daysWithFood, daysWithSteps, daysWithMinutes, daysWithProtein, totalDays: dates.length,
    weightChange,
    dates, kcalPerDay, stepsPerDay, minutesPerDay, proteinPerDay,
  };
}

/* ============================== Primitives =============================== */

function Card({ children, className = "", glow = false, ...rest }) {
  return (
    <div className={`rounded-3xl bg-white/[0.05] border border-white/10 backdrop-blur-xl ${glow ? "shadow-lg shadow-pink-400/10" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
        active
          ? `${GRAD} text-white border-transparent shadow-md shadow-pink-400/30 scale-105`
          : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function GradientButton({ children, onClick, className = "", type = "button", disabled, warm = false, size = "md" }) {
  const pad = size === "lg" ? "px-6 py-3.5 text-base" : size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${warm ? GRAD_WARM : GRAD} ${pad} rounded-2xl font-semibold text-white shadow-lg shadow-pink-400/20 hover:shadow-xl hover:shadow-pink-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, className = "", danger = false, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${
        danger
          ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
          : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ProgressRing({ pct, size = 88, stroke = 9, colorFrom = "#d16d94", colorTo = "#d1935a", label, sub, center }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(clamp(pct, 0, 100)), 80);
    return () => clearTimeout(t);
  }, [pct]);
  const gradId = useRef(uid("ring")).current;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${gradId})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (animPct / 100) * c}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.34,1.56,.64,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {center || (
          <>
            <span className="text-lg font-bold text-white leading-none">{Math.round(pct)}%</span>
            {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
          </>
        )}
      </div>
      {label && <span className="absolute -bottom-6 text-xs text-slate-400 whitespace-nowrap">{label}</span>}
    </div>
  );
}

// Locks background scrolling while a fixed-position overlay (modal, drawer, lightbox) is
// open. Without this, scrolling the page behind an overlay can cause mobile browsers to
// reflow their address bar and misposition `position: fixed` elements — which is what was
// cutting off the top of these dialogs.
function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = prevWidth;
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useLockBodyScroll(open);
  if (!open) return null;
  const widthClass = size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className={`relative w-full ${widthClass} max-h-[85vh] min-h-0 flex flex-col rounded-3xl bg-slate-900 border border-white/10 shadow-2xl animate-[popIn_.2s_ease-out]`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="text-slate-300 text-sm px-6 pb-6 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-6 pb-6 pt-0 flex gap-3 justify-end shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-[slideUp_.25s_ease-out]">
      <div className={`${GRAD} px-5 py-3 rounded-2xl shadow-2xl shadow-pink-400/40 flex items-center gap-2.5 text-white font-semibold text-sm`}>
        <span className="text-lg leading-none">{toast.icon}</span>
        {toast.message}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub, action }) {
  return (
    <Card className="p-10 flex flex-col items-center text-center gap-3">
      <div className="text-5xl mb-1">{icon}</div>
      <h3 className="text-white font-bold text-lg">{title}</h3>
      {sub && <p className="text-slate-400 text-sm max-w-sm">{sub}</p>}
      {action}
    </Card>
  );
}

function SectionHeading({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
      <div>
        {eyebrow && <div className={`text-xs font-semibold tracking-wider uppercase mb-1 ${GRAD_TEXT}`}>{eyebrow}</div>}
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function AchievementsGrid({ unlockedIds = [] }) {
  const PAGE_SIZE = 15; // divides evenly into both the 3-col mobile and 5-col desktop grid
  const pageCount = Math.ceil(ACHIEVEMENTS.length / PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const clampedPage = Math.min(page, pageCount - 1);
  const items = ACHIEVEMENTS.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  const unlockedSet = new Set(unlockedIds);
  const selectedUnlocked = selected ? unlockedSet.has(selected.id) : false;

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {items.map((a) => {
          const unlocked = unlockedSet.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              aria-label={`${a.name} — tap to see what this badge means`}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-colors focus:outline-none focus:ring-2 focus:ring-pink-400/50 ${
                unlocked ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20" : "bg-white/[0.02] border-white/5 opacity-40 hover:opacity-70"
              }`}
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[10px] text-slate-300 font-medium leading-tight">{a.name}</span>
            </button>
          );
        })}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
              aria-current={clampedPage === i}
              className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                clampedPage === i ? `${GRAD} text-white` : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ""}>
        {selected && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border ${
              selectedUnlocked ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.03] border-white/10"
            }`}>
              {selected.icon}
            </div>
            <p className="text-slate-300 text-sm">{selected.desc}</p>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              selectedUnlocked ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-slate-500 border border-white/10"
            }`}>
              {selectedUnlocked ? "Unlocked" : "Locked"}
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Avatar({ name, swatch, photoUrl, size = "md", ring = false }) {
  const dim = size === "lg" ? "w-16 h-16 text-xl" : size === "sm" ? "w-8 h-8 text-xs" : "w-11 h-11 text-sm";
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const ringCls = ring ? "ring-2 ring-white/20 ring-offset-2 ring-offset-slate-950" : "";
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${dim} rounded-full object-cover shrink-0 ${ringCls}`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br ${swatch || AVATAR_SWATCHES[0]} flex items-center justify-center font-bold text-white shrink-0 ${ringCls}`}>
      {initials}
    </div>
  );
}

function StatBlock({ icon, label, value, accent = "text-white" }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className={`text-lg font-bold leading-tight ${accent}`}>{value}</div>
        <div className="text-[11px] text-slate-400 leading-snug">{label}</div>
      </div>
    </div>
  );
}

/* =============================== Auth screens ============================= */

function BackgroundGlow() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-pink-500/25 blur-3xl" />
      <div className="absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
    </div>
  );
}

function Wordmark({ size = "text-3xl" }) {
  return (
    <div className={`font-black tracking-tight ${size} flex items-center gap-2`}>
      <span className={`w-8 h-8 rounded-xl ${GRAD_DIAG} inline-flex items-center justify-center text-white text-base`}>◆</span>
      <span className={GRAD_TEXT}>KBL</span>
    </div>
  );
}

function LoginScreen({ onGoogleSignIn }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <BackgroundGlow />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Wordmark size="text-4xl" />
          <p className="text-slate-400 mt-3 text-sm max-w-xs">
            The private training hub for you and your crew. Log workouts, track every rep, and push each other forward.
          </p>
        </div>
        <Card className="p-6">
          <div className="flex flex-col gap-3">
            <GradientButton size="lg" onClick={onGoogleSignIn}>
              <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
                <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.6 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.2l6-6C34.9 4.1 29.7 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.1-2.7-.5-4z"/>
              </svg>
              Continue with Google
            </GradientButton>
            <p className="text-center text-[11px] text-slate-500">The first person to sign in becomes admin. Everyone after that needs approval.</p>
          </div>
        </Card>
        <p className="text-center text-xs text-slate-600 mt-6">Sign in and start training right away. Admin approval unlocks the Members list &amp; Leaderboard.</p>
      </div>
    </div>
  );
}

function PendingApprovalBanner({ onRefresh, refreshing }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-100">
      <div className="w-9 h-9 shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-base">⏳</div>
      <p className="flex-1 min-w-0 text-xs sm:text-sm leading-snug">
        <span className="font-semibold">Waiting for admin approval.</span>{" "}
        You can use everything already — once approved you'll also show up on the Members list and Leaderboard.
      </p>
      <button
        onClick={onRefresh} disabled={refreshing} aria-label="Check approval status"
        className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-amber-100 flex items-center justify-center transition-colors disabled:opacity-50"
        title="Check status"
      >
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

/* ================================== Shell ================================= */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "today", label: "Today", icon: CalendarCheck },
  { id: "programs", label: "Programs", icon: Dumbbell },
  { id: "diet", label: "Diet", icon: UtensilsCrossed },
  { id: "members", label: "Members", icon: Users },
];

function NavList({ page, goTo, vertical = true }) {
  return (
    <nav className={`relative flex ${vertical ? "flex-col gap-1" : "flex-row gap-1"}`}>
      {NAV_ITEMS.map((item) => {
        const active = page === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => goTo(item.id)}
            className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group ${
              active ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {active && (
              <span className={`absolute inset-0 rounded-2xl ${GRAD} shadow-lg shadow-pink-400/30 animate-[popIn_.25s_ease-out]`} />
            )}
            <Icon size={18} className="relative z-10" />
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ me, page, goTo, onOpenProfile, onSignOut }) {
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-white/10 bg-slate-950/60 backdrop-blur-xl p-5">
      <Wordmark />
      <button onClick={() => onOpenProfile()} className="mt-7 flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left">
        <Avatar name={me.name} swatch={me.avatar} photoUrl={me.avatarUrl} ring />
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate">{me.name}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Flame size={11} className="text-orange-400" /> {me.streak}-day streak
          </div>
        </div>
      </button>

      <div className="mt-6 flex-1">
        <NavList page={page} goTo={goTo} />
      </div>

      <div className="pt-4 border-t border-white/10 flex flex-col gap-1">
        <button
          onClick={() => goTo("profile")}
          className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
            page === "profile" ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {page === "profile" && <span className={`absolute inset-0 rounded-2xl ${GRAD} shadow-lg shadow-pink-400/30`} />}
          <User size={18} className="relative z-10" />
          <span className="relative z-10">Profile</span>
        </button>
        <button onClick={onSignOut} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileTopbar({ me, onMenu }) {
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
      <button onClick={onMenu} aria-label="Open menu" className="p-2 rounded-xl hover:bg-white/10 text-white"><Menu size={20} /></button>
      <Wordmark size="text-lg" />
      <Avatar name={me.name} swatch={me.avatar} photoUrl={me.avatarUrl} size="sm" />
    </div>
  );
}

function MobileDrawer({ open, onClose, me, page, goTo, onSignOut }) {
  useLockBodyScroll(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-950 border-r border-white/10 p-5 flex flex-col animate-[slideRight_.2s_ease-out]">
        <div className="flex items-center justify-between">
          <Wordmark size="text-xl" />
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-full hover:bg-white/10 text-slate-400"><X size={18} /></button>
        </div>
        <button onClick={() => { goTo("profile"); onClose(); }} className="mt-6 flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 text-left">
          <Avatar name={me.name} swatch={me.avatar} photoUrl={me.avatarUrl} ring />
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate">{me.name}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1"><Flame size={11} className="text-orange-400" /> {me.streak}-day streak</div>
          </div>
        </button>
        <div className="mt-6 flex-1">
          <NavList page={page} goTo={(id) => { goTo(id); onClose(); }} />
        </div>
        <div className="pt-4 border-t border-white/10 flex flex-col gap-1">
          <button onClick={() => { goTo("profile"); onClose(); }} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
            <User size={18} /> Profile
          </button>
          <button onClick={onSignOut} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-rose-300 hover:bg-rose-500/10">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================== Dashboard ================================ */

export function weekBoundsISO(iso) {
  const d = isoToDate(iso);
  const jsDay = d.getDay(); // 0=sun
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = addDaysISO(iso, mondayOffset);
  const sunday = addDaysISO(monday, 6);
  return [monday, sunday];
}

function countScheduledProgress(me, program, startISO, endISO) {
  let total = 0, done = 0;
  if (!program) return { total, done };
  let day = startISO;
  let guard = 0;
  while (day <= endISO && guard < 400) {
    const sched = program.days[dayKeyForISO(day)];
    if (sched?.type === "workout") {
      total++;
      if (me.worklogs[day]?.completedAt) done++;
    }
    day = addDaysISO(day, 1);
    guard++;
  }
  return { total, done };
}

function monthEndISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y, m, 0); // day 0 of next month = last day of this month
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export function computeProgress(me, program, todayOverride) {
  const iso = todayOverride || todayISO();
  const [weekStart] = weekBoundsISO(iso);
  const monthStart = iso.slice(0, 8) + "01";
  // Month total covers every scheduled workout day in the whole month (Aug 1–31), not
  // just the days elapsed so far — so "3/4" only shows once the month is actually done
  // and there really were 4 scheduled sessions total. Early in the month this means the
  // denominator already reflects the full month while the numerator (done) can only ever
  // count days that have already happened, since future days have no completedAt yet.
  const monthEnd = monthEndISO(iso);
  // Computed independently (not as one combined loop) because the current week can
  // dip into the previous month — e.g. a Monday week-start on the last days of August
  // while "today" is already in September. A single month-anchored loop would silently
  // undercount those early-week days.
  const week = countScheduledProgress(me, program, weekStart, iso);
  const month = countScheduledProgress(me, program, monthStart, monthEnd);
  return {
    weekPct: week.total ? Math.round((week.done / week.total) * 100) : 0,
    monthPct: month.total ? Math.round((month.done / month.total) * 100) : 0,
    weekDone: week.done, weekTotal: week.total, monthDone: month.done, monthTotal: month.total,
  };
}

function last7DaysVolume(me) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const iso = addDaysISO(todayISO(), -i);
    let vol = 0;
    Object.values(me.history || {}).forEach((arr) => {
      arr.forEach((h) => { if (h.date === iso) vol += h.volume; });
    });
    days.push({ day: isoToDate(iso).toLocaleDateString(undefined, { weekday: "short" })[0], vol, iso });
  }
  return days;
}

function MiniBarChart({ data, onSelect }) {
  const max = Math.max(1, ...data.map((d) => d.vol));
  return (
    <div className="flex items-end gap-2 h-20">
      {data.map((d, i) => {
        const isToday = d.iso === todayISO();
        const Wrapper = onSelect ? "button" : "div";
        return (
          <Wrapper
            key={i}
            type={onSelect ? "button" : undefined}
            onClick={onSelect ? () => onSelect(d.iso) : undefined}
            aria-label={onSelect ? `View ${formatNiceDate(d.iso)} — ${d.vol}kg volume` : undefined}
            className={`flex-1 flex flex-col items-center gap-1.5 ${onSelect ? "cursor-pointer group" : ""}`}
          >
            <div className="w-full rounded-t-lg bg-white/5 relative overflow-hidden" style={{ height: 64 }}>
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-t-lg ${GRAD} ${onSelect ? "group-hover:opacity-80 transition-opacity" : ""}`}
                style={{ height: `${(d.vol / max) * 100}%`, transition: "height .8s cubic-bezier(.34,1.56,.64,1)" }}
              />
            </div>
            <span className={`text-[10px] ${isToday ? "text-pink-300 font-semibold" : "text-slate-500"} ${onSelect ? "group-hover:text-white transition-colors" : ""}`}>{d.day}</span>
          </Wrapper>
        );
      })}
    </div>
  );
}

function Dashboard({ me, members, programs, goTo, onSelectDate }) {
  const program = me.activeProgramId ? programs[me.activeProgramId] : null;
  const lvl = levelInfo(me.xp);
  const progress = useMemo(() => computeProgress(me, program), [me, program]);
  const quote = pickDaily(me.name, WORKOUT_QUOTES);
  const todaySched = program?.days?.[todayDayKey()];
  const isRest = !program || todaySched?.type !== "workout";
  const vol7 = useMemo(() => last7DaysVolume(me), [me]);

  const leaderboard = useMemo(
    () => Object.values(members).filter((m) => m.status === "approved").sort((a, b) => b.xp - a.xp).slice(0, 5),
    [members]
  );

  const recentAch = (me.unlocked || []).slice(-3).reverse().map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean);

  // next rest day
  let nextRest = null;
  if (program) {
    for (let i = 1; i <= 7; i++) {
      const iso = addDaysISO(todayISO(), i);
      if (program.days[dayKeyForISO(iso)]?.type !== "workout") { nextRest = iso; break; }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white">Welcome back, {me.name.split(" ")[0]} 👋</h1>
        <p className={`mt-1.5 text-base font-medium ${GRAD_TEXT}`}>{quote}</p>
        <p className="text-slate-500 text-sm mt-1">{formatNiceDate(todayISO())}</p>
      </div>

      {/* Overall progress */}
      <Card className="p-6">
        <SectionHeading eyebrow="Overview" title="Overall progress" />
        <div className="flex flex-wrap gap-8 items-center justify-around">
          <ProgressRing pct={progress.weekPct} colorFrom="#d16d94" colorTo="#c9ad55" label="This week" sub={`${progress.weekDone}/${progress.weekTotal || 0}`} />
          <ProgressRing pct={progress.monthPct} colorFrom="#5a9fb3" colorTo="#5fa87e" label="This month" sub={`${progress.monthDone}/${progress.monthTotal || 0}`} />
          <div className="flex flex-col items-center gap-1">
            <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/30 flex flex-col items-center justify-center">
              <Flame className="text-orange-400" size={22} />
              <span className="text-lg font-bold text-white leading-none mt-1">{me.streak}</span>
            </div>
            <span className="text-xs text-slate-400 mt-1">Day streak</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-[160px]">
            <div className="flex flex-col items-center gap-0.5 w-full text-sm">
              <span className="text-white font-bold flex items-center gap-1"><Star size={14} className="text-amber-400" /> Level {lvl.level}</span>
              <span className="text-slate-400 text-xs">{lvl.into}/{lvl.need} XP</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full ${GRAD_WARM} rounded-full`} style={{ width: `${lvl.pct}%`, transition: "width 1s cubic-bezier(.34,1.56,.64,1)" }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Today's workout */}
        <Card className="p-6 md:col-span-2 flex flex-col justify-between" glow>
          <div>
            <SectionHeading eyebrow="Today" title={isRest ? "Rest day" : `${DAY_LABEL[todayDayKey()]} Session`} />
            {isRest ? (
              <p className="text-slate-400 text-sm">No workout scheduled today — recovery is on the plan. {nextRest && <>Next session {formatShortDate(nextRest)}.</>}</p>
            ) : (
              <div className="flex flex-wrap gap-4 text-sm text-slate-300 mb-2">
                <span className="flex items-center gap-1.5"><Clock size={15} className="text-emerald-400" /> ~{todaySched.exercises.length * 9} min</span>
                <span className="flex items-center gap-1.5"><ListChecks size={15} className="text-pink-400" /> {todaySched.exercises.length} exercises</span>
                <span className="flex items-center gap-1.5"><Target size={15} className="text-amber-400" /> {Array.from(new Set(todaySched.exercises.map((e) => getEx(e.exerciseId)?.muscle))).join(", ")}</span>
              </div>
            )}
          </div>
          <GradientButton size="lg" className="mt-4 w-full sm:w-fit" onClick={() => goTo("today")}>
            <Play size={18} fill="white" /> {isRest ? "View rest day" : "Start workout"}
          </GradientButton>
        </Card>

        {/* Leaderboard preview */}
        <Card className="p-6">
          <SectionHeading eyebrow="Crew" title="Leaderboard" right={<button onClick={() => goTo("members")} className="text-xs text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-0.5">All <ChevronRight size={13} /></button>} />
          <div className="flex flex-col gap-2.5">
            {leaderboard.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <span className={`w-5 text-xs font-bold ${i === 0 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</span>
                <Avatar name={m.name} swatch={m.avatar} photoUrl={m.avatarUrl} size="sm" />
                <span className="text-sm text-slate-200 truncate flex-1">{m.id === me.id ? "You" : m.name}</span>
                <span className="text-xs font-semibold text-slate-400">{m.xp} XP</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2">
          <SectionHeading eyebrow="Momentum" title="Volume, last 7 days" />
          <MiniBarChart data={vol7} onSelect={onSelectDate} />
        </Card>
        <Card className="p-6">
          <SectionHeading eyebrow="Latest" title="Achievements" />
          {recentAch.length === 0 ? (
            <p className="text-sm text-slate-500">Complete a workout to start unlocking badges.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recentAch.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-2xl">{a.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{a.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ================================= Today =================================== */

// Snaps a value to the nearest 0.5 — used only by NumberField's +/- steppers
// so a half-step field (e.g. bodyweight, step=0.5) always lands on a clean
// half-unit instead of accumulating floating-point drift. NOT for display
// rounding — see round1 below for that.
function roundHalf(n) { return Math.round(n * 2) / 2; }

function NumberField({ value, onChange, step = 1, min = 0, width = "w-14", label = "value" }) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, roundHalf(value - step)))} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center shrink-0">
        <Minus size={12} />
      </button>
      <input
        type="number" value={value} aria-label={label}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className={`${width} text-center bg-white/5 border border-white/10 rounded-lg py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-400/50`}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(roundHalf(value + step))} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center shrink-0">
        <Plus size={12} />
      </button>
    </div>
  );
}

// Renders the right "weight" control for an exercise's loadType:
//  - external: a plain kg NumberField (unchanged behavior)
//  - bodyweight: an "added weight" NumberField (extra load, defaults to 0) plus a
//    live estimated total (bodyweight × coefficient + added). onChange always
//    reports { weight, addedWeight } so the total is what's stored/tracked.
//  - cardio: no weight to log
function LoadField({ ex, weight, addedWeight, bodyweightKg, done, onChange, width = "w-14" }) {
  if (!ex) return null;
  if (ex.loadType === "cardio") {
    return <span className="text-slate-500 italic">time / distance based</span>;
  }
  if (ex.loadType === "bodyweight") {
    const added = Number(addedWeight) || 0;
    const est = computeBodyweightLoad(ex, added, bodyweightKg);
    if (done) {
      return (
        <span>
          <b className="text-white">≈{weight}kg</b>{" "}
          <span className="text-slate-500">({ex.bwPercent}% BW{added > 0 ? ` +${added}kg` : ""})</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        <span>+wt</span>
        <NumberField
          value={added}
          onChange={(v) => onChange({ addedWeight: v, weight: computeBodyweightLoad(ex, v, bodyweightKg) })}
          step={2.5} min={0} width={width} label="added weight in kilograms"
        />
        <span className="text-slate-500">≈{est}kg total</span>
      </span>
    );
  }
  // external
  if (done) return <b className="text-white">{weight}kg</b>;
  return <NumberField value={weight} onChange={(v) => onChange({ weight: v })} step={2.5} min={0} width={width} label="weight in kilograms" />;
}

function buildTodayInstances(me, todaySched, iso) {
  const saved = me.worklogs[iso];
  return (todaySched?.exercises || []).map((pex) => {
    const savedEx = saved?.exercises?.[pex.exerciseId];
    if (savedEx) return { ...savedEx, id: pex.id, exerciseId: pex.exerciseId };
    const ex = getEx(pex.exerciseId);
    const hist = me.history[pex.exerciseId] || [];
    const last = hist[hist.length - 1];
    if (ex?.loadType === "bodyweight") {
      const addedWeight = last ? (last.addedWeight ?? 0) : (pex.targetAddedWeight ?? 0);
      const weight = computeBodyweightLoad(ex, addedWeight, me.bodyweightKg);
      return { id: pex.id, exerciseId: pex.exerciseId, sets: pex.sets, reps: pex.reps, weight, addedWeight, done: false, isPR: false };
    }
    if (ex?.loadType === "cardio") {
      return { id: pex.id, exerciseId: pex.exerciseId, sets: pex.sets, reps: pex.reps, weight: 0, done: false, isPR: false };
    }
    return { id: pex.id, exerciseId: pex.exerciseId, sets: pex.sets, reps: pex.reps, weight: last ? last.weight : pex.targetWeight, done: false, isPR: false };
  });
}

function RestDayView({ me }) {
  const quote = pickDaily(me.name + "rest", REST_QUOTES);
  const tip = pickDaily(me.name + "tip", RECOVERY_TIPS);
  return (
    <Card
      className="relative overflow-hidden p-10 md:p-14 flex flex-col items-center text-center gap-5 bg-gradient-to-br from-pink-500/10 via-amber-400/5 to-transparent"
      glow
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(216,109,148,0.12), transparent 45%), radial-gradient(circle at 75% 70%, rgba(201,173,85,0.10), transparent 50%)",
          backgroundSize: "180% 180%",
          animation: "restGradientDrift 10s ease-in-out infinite",
        }}
      />
      <div className="relative flex items-center justify-center h-20 w-20">
        <div
          className="absolute inset-0 rounded-full bg-amber-300/30 blur-xl"
          style={{ animation: "moonGlow 3.5s ease-in-out infinite" }}
        />
        <div className="relative text-6xl" style={{ animation: "moonFloat 4.5s ease-in-out infinite" }}>🌙</div>
      </div>
      <h2 className="text-2xl font-black text-white">Rest day</h2>
      <p className={`text-lg font-medium max-w-md ${GRAD_TEXT}`}>{quote}</p>
      <div className="mt-2 max-w-md p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 text-left">
        <Sparkles size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">{tip}</p>
      </div>
    </Card>
  );
}

function ExerciseProgressCard({ inst, onChange, onComplete, onOpen, done, bodyweightKg }) {
  const ex = getEx(inst.exerciseId);
  const volume = volumeOf(inst.sets, inst.reps, inst.weight);
  const isCardio = ex?.loadType === "cardio";
  return (
    <div
      onClick={() => onOpen(inst.exerciseId)}
      className={`rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:border-white/20 ${
        done ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.04] border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{ex?.icon}</span>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate">{ex?.name}</div>
            <div className="text-[11px] text-slate-500">{ex?.muscle}{inst.prevResult ? ` · Previous: ${inst.prevResult}` : " · First time!"}</div>
          </div>
        </div>
        {!done ? (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            className={`w-9 h-9 rounded-full ${GRAD} flex items-center justify-center text-white shadow-md shadow-pink-400/30 hover:scale-110 active:scale-95 transition-transform shrink-0`}
            aria-label="Mark complete"
          >
            <Check size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {inst.isPR && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">PR 🎉</span>}
            <span className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><Check size={16} /></span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400" onClick={(e) => done && e.stopPropagation()}>
        <div className="flex items-center gap-1.5">Sets {done ? <b className="text-white">{inst.sets}</b> : <NumberField value={inst.sets} onChange={(v) => onChange({ sets: v })} step={1} min={1} width="w-10" label="sets" />}</div>
        <div className="flex items-center gap-1.5">Reps {done ? <b className="text-white">{inst.reps}</b> : <NumberField value={inst.reps} onChange={(v) => onChange({ reps: v })} step={1} min={1} width="w-10" label="reps" />}</div>
        {!isCardio && (
          <div className="flex items-center gap-1.5">
            {ex?.loadType === "bodyweight" ? "Added" : "Weight"}{" "}
            <LoadField ex={ex} weight={inst.weight} addedWeight={inst.addedWeight} bodyweightKg={bodyweightKg} done={done} onChange={onChange} />
          </div>
        )}
        {!isCardio && <div className="flex items-center gap-1.5 ml-auto text-slate-500">Volume <b className="text-emerald-300">{volume}kg</b></div>}
      </div>
    </div>
  );
}

function TodayPage({ me, programs, openExercise, onCompleteExercise, onEditDone, onCreateProgram }) {
  const program = me.activeProgramId ? programs[me.activeProgramId] : null;
  const iso = todayISO();
  const dayKey = todayDayKey();
  const todaySched = program?.days?.[dayKey];
  const [tab, setTab] = useState("progress");
  const buildKey = `${me.activeProgramId}_${iso}`;
  const lastBuildKey = useRef(null);
  const [instances, setInstances] = useState([]);

  useEffect(() => {
    if (lastBuildKey.current !== buildKey && todaySched?.type === "workout") {
      const built = buildTodayInstances(me, todaySched, iso).map((inst) => {
        const hist = me.history[inst.exerciseId] || [];
        const prev = hist[hist.length - (inst.done ? 2 : 1)];
        return { ...inst, prevResult: prev ? `${prev.sets}×${prev.reps} @ ${prev.weight}kg` : null };
      });
      setInstances(built);
      lastBuildKey.current = buildKey;
    }
  }, [buildKey, todaySched, me]);

  if (!program) {
    return (
      <EmptyState
        icon="🗓️"
        title="No active program yet"
        sub="Create a workout program and activate it to see your daily session here."
        action={<GradientButton onClick={onCreateProgram}><Plus size={16} /> Create a program</GradientButton>}
      />
    );
  }
  if (todaySched?.type !== "workout") {
    return <RestDayView me={me} />;
  }

  const update = (idx, patch) => setInstances((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const complete = (idx) => {
    const inst = instances[idx];
    const hist = me.history[inst.exerciseId] || [];
    const prevMax = hist.reduce((m, h) => Math.max(m, h.weight), 0);
    const isPR = inst.weight > prevMax;
    const finalized = { ...inst, done: true, isPR };
    setInstances((prev) => prev.map((it, i) => (i === idx ? finalized : it)));
    onCompleteExercise(finalized, instances.map((it, i) => (i === idx ? finalized : it)));
  };

  const todo = instances.filter((i) => !i.done);
  const done = instances.filter((i) => i.done);
  const pct = instances.length ? Math.round((done.length / instances.length) * 100) : 0;
  const muscles = Array.from(new Set(todaySched.exercises.map((e) => getEx(e.exerciseId)?.muscle)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className={`text-xs font-semibold tracking-wider uppercase mb-1 ${GRAD_TEXT}`}>{DAY_LABEL[dayKey]}</div>
        <h1 className="text-2xl md:text-3xl font-black text-white">{program.name}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-2">
          <span className="flex items-center gap-1.5"><Target size={15} className="text-amber-400" /> {muscles.join(", ")}</span>
          <span className="flex items-center gap-1.5"><Clock size={15} className="text-emerald-400" /> ~{instances.length * 9} min</span>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">Workout progress</span>
          <span className="text-sm text-slate-400">{done.length}/{instances.length} done</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full ${GRAD} rounded-full`} style={{ width: `${pct}%`, transition: "width .6s cubic-bezier(.34,1.56,.64,1)" }} />
        </div>
      </Card>

      <div className="flex gap-2">
        <Chip active={tab === "progress"} onClick={() => setTab("progress")}>On Progress ({todo.length})</Chip>
        <Chip active={tab === "done"} onClick={() => setTab("done")}>Done ({done.length})</Chip>
      </div>

      <div className="flex flex-col gap-3">
        {tab === "progress" && (
          todo.length === 0 ? (
            <EmptyState icon="🎉" title="All exercises logged!" sub="Great work — check the Done tab to review or edit today's numbers." />
          ) : (
            todo.map((inst) => {
              const idx = instances.findIndex((i) => i.id === inst.id);
              return <ExerciseProgressCard key={inst.id} inst={inst} done={false} onChange={(p) => update(idx, p)} onComplete={() => complete(idx)} onOpen={openExercise} bodyweightKg={me.bodyweightKg} />;
            })
          )
        )}
        {tab === "done" && (
          done.length === 0 ? (
            <EmptyState icon="💤" title="Nothing logged yet" sub="Finish an exercise on the On Progress tab and it'll land here." />
          ) : (
            done.map((inst) => {
              const idx = instances.findIndex((i) => i.id === inst.id);
              return (
                <DoneExerciseCard
                  key={inst.id} inst={inst} onOpen={openExercise} bodyweightKg={me.bodyweightKg}
                  onSave={(patch) => {
                    const updated = { ...inst, ...patch };
                    const hist = me.history[inst.exerciseId] || [];
                    const priorMax = hist.reduce((mx, h, i) => (i === hist.length - 1 ? mx : Math.max(mx, h.weight)), 0);
                    updated.isPR = updated.weight > priorMax;
                    setInstances((prev) => prev.map((it, i) => (i === idx ? updated : it)));
                    onEditDone(inst, updated);
                  }}
                />
              );
            })
          )
        )}
      </div>
    </div>
  );
}

function DoneExerciseCard({ inst, onOpen, onSave, bodyweightKg }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ sets: inst.sets, reps: inst.reps, weight: inst.weight, addedWeight: inst.addedWeight });
  const ex = getEx(inst.exerciseId);
  const isCardio = ex?.loadType === "cardio";
  const volume = volumeOf(draft.sets, draft.reps, draft.weight);

  if (!editing) {
    return (
      <div onClick={() => onOpen(inst.exerciseId)} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/30 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{ex?.icon}</span>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate flex items-center gap-2">
              {ex?.name}
              {inst.isPR && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">PR</span>}
            </div>
            <div className="text-[11px] text-slate-400">
              {inst.sets}×{inst.reps}{!isCardio ? ` @ ${inst.weight}kg · Volume ${volumeOf(inst.sets, inst.reps, inst.weight)}kg` : ""}
            </div>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setDraft({ sets: inst.sets, reps: inst.reps, weight: inst.weight, addedWeight: inst.addedWeight }); setEditing(true); }} aria-label={`Edit logged ${ex?.name || "exercise"}`} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white shrink-0">
          <Pencil size={15} />
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3"><span className="text-2xl">{ex?.icon}</span><span className="text-white font-semibold text-sm">{ex?.name}</span></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">Sets <NumberField value={draft.sets} onChange={(v) => setDraft((d) => ({ ...d, sets: v }))} step={1} min={1} width="w-10" label="sets" /></div>
        <div className="flex items-center gap-1.5">Reps <NumberField value={draft.reps} onChange={(v) => setDraft((d) => ({ ...d, reps: v }))} step={1} min={1} width="w-10" label="reps" /></div>
        {!isCardio && (
          <div className="flex items-center gap-1.5">
            {ex?.loadType === "bodyweight" ? "Added" : "Weight"}{" "}
            <LoadField ex={ex} weight={draft.weight} addedWeight={draft.addedWeight} bodyweightKg={bodyweightKg} done={false} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          </div>
        )}
        {!isCardio && <div className="ml-auto text-slate-500">Volume <b className="text-emerald-300">{volume}kg</b></div>}
      </div>
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
        <GradientButton onClick={() => { onSave(draft); setEditing(false); }}><Save size={14} /> Save</GradientButton>
      </div>
    </div>
  );
}

/* =============================== Day detail ================================ */
// Reached by tapping a date on the Consistency calendar. Shows what was scheduled
// and what got logged that day, and — for any date, past or present — lets you
// log, edit, or clear each exercise's numbers right here via an inline editor,
// independent of the live Today page.
function DayDetailExerciseRow({ iso, e, ex, doneEntry, bodyweightKg, onOpen, onSaveEntry, onClearEntry }) {
  const [editing, setEditing] = useState(false);
  const isCardio = ex?.loadType === "cardio";
  const defaults = doneEntry
    ? { sets: doneEntry.sets, reps: doneEntry.reps, weight: doneEntry.weight, addedWeight: doneEntry.addedWeight }
    : { sets: e.sets, reps: e.reps, weight: e.targetWeight ?? 0, addedWeight: e.targetAddedWeight ?? 0 };
  const [draft, setDraft] = useState(defaults);

  const startEditing = () => { setDraft(defaults); setEditing(true); };
  const volume = volumeOf(draft.sets, draft.reps, draft.weight);

  if (editing) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3"><span className="text-2xl">{ex?.icon}</span><span className="text-white font-semibold text-sm">{ex?.name}</span></div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">Sets <NumberField value={draft.sets} onChange={(v) => setDraft((d) => ({ ...d, sets: v }))} step={1} min={1} width="w-10" label="sets" /></div>
          <div className="flex items-center gap-1.5">Reps <NumberField value={draft.reps} onChange={(v) => setDraft((d) => ({ ...d, reps: v }))} step={1} min={1} width="w-10" label="reps" /></div>
          {!isCardio && (
            <div className="flex items-center gap-1.5">
              {ex?.loadType === "bodyweight" ? "Added" : "Weight"}{" "}
              <LoadField ex={ex} weight={draft.weight} addedWeight={draft.addedWeight} bodyweightKg={bodyweightKg} done={false} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
            </div>
          )}
          {!isCardio && <div className="ml-auto text-slate-500">Volume <b className="text-emerald-300">{volume}kg</b></div>}
        </div>
        <div className="flex gap-2 justify-end flex-wrap">
          {doneEntry && (
            <GhostButton danger onClick={() => { onClearEntry(iso, e.exerciseId); setEditing(false); }}>
              <Trash2 size={14} /> Clear log
            </GhostButton>
          )}
          <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          <GradientButton onClick={() => { onSaveEntry(iso, e.exerciseId, draft); setEditing(false); }}><Save size={14} /> Save</GradientButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-colors ${doneEntry ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}
    >
      <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => onOpen(e.exerciseId)}>
        <span className="text-xl shrink-0">{ex?.icon}</span>
        <div className="min-w-0">
          <div className="text-white text-sm font-semibold truncate">{ex?.name}</div>
          <div className="text-[11px] text-slate-400">
            {doneEntry
              ? `${doneEntry.sets}×${doneEntry.reps}${ex?.loadType !== "cardio" ? ` @ ${doneEntry.weight}kg` : ""}`
              : `Target ${e.sets}×${e.reps}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {doneEntry ? <Check size={16} className="text-emerald-400" /> : <span className="text-[11px] text-slate-500">Not logged</span>}
        <button
          onClick={startEditing}
          aria-label={doneEntry ? `Edit logged ${ex?.name || "exercise"}` : `Log ${ex?.name || "exercise"}`}
          className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  );
}

function DayDetailPage({ iso, me, programs, onBack, openExercise, goToToday, onEditEntry, onClearEntry }) {
  const program = me.activeProgramId ? programs[me.activeProgramId] : null;
  const dayKey = dayKeyForISO(iso);
  const sched = program?.days?.[dayKey];
  const log = me.worklogs[iso];
  const isToday = iso === todayISO();
  const isWorkoutDay = program && sched?.type === "workout";
  const loggedVolume = Object.values(log?.exercises || {}).reduce((s, e) => s + volumeOf(e.sets, e.reps, e.weight), 0);

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit">
        <ArrowLeft size={16} /> Back to profile
      </button>

      <div>
        <div className={`text-xs font-semibold tracking-wider uppercase mb-1 ${GRAD_TEXT}`}>{DAY_LABEL[dayKey]}</div>
        <h1 className="text-2xl md:text-3xl font-black text-white">{formatNiceDate(iso)}</h1>
      </div>

      {isToday && (
        <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-slate-300">This is today — you can also log or edit sets on the Today tab.</span>
          <GradientButton size="sm" onClick={goToToday}>Go to Today <ChevronRight size={14} /></GradientButton>
        </Card>
      )}

      {!isWorkoutDay ? (
        <EmptyState
          icon="🌙" title="Rest day"
          sub={program ? "No workout was scheduled for this day." : "No active program was set for this day."}
        />
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <SectionHeading eyebrow="Session" title={program.name} />
            {loggedVolume > 0 && <span className="text-xs font-semibold text-emerald-300 shrink-0">Volume {loggedVolume}kg</span>}
          </div>
          <p className="text-[11px] text-slate-500 -mt-2 mb-1">Tap the pencil to log, edit, or clear any exercise for this day.</p>
          <div className="flex flex-col gap-2.5">
            {sched.exercises.map((e, i) => {
              const ex = getEx(e.exerciseId);
              const doneEntry = log?.exercises?.[e.exerciseId];
              return (
                <DayDetailExerciseRow
                  key={e.id || i} iso={iso} e={e} ex={ex} doneEntry={doneEntry} bodyweightKg={me.bodyweightKg}
                  onOpen={openExercise} onSaveEntry={onEditEntry} onClearEntry={onClearEntry}
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================= Exercise Detail ============================= */

function exerciseStats(hist) {
  const iso = todayISO();
  const weekAgo = addDaysISO(iso, -7);
  const monthAgo = addDaysISO(iso, -30);
  const yearAgo = addDaysISO(iso, -365);
  const sum = (arr) => arr.reduce((s, h) => s + h.volume, 0);
  const pr = hist.reduce((best, h) => (h.weight > (best?.weight || 0) ? h : best), null);
  return {
    lifetime: sum(hist),
    weekly: sum(hist.filter((h) => h.date >= weekAgo)),
    monthly: sum(hist.filter((h) => h.date >= monthAgo)),
    yearly: sum(hist.filter((h) => h.date >= yearAgo)),
    pr,
    sessions: hist.length,
  };
}

// Shared time-range filter for the exercise trend chart + history list, so "how far
// back" is one control instead of a hardcoded slice(-6)/slice(-12) that silently
// hides older sessions with no way to see them.
const HIST_RANGES = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];
function filterHistByRange(hist, range) {
  if (range === "all") return hist;
  const days = range === "week" ? 7 : 30;
  const cutoff = addDaysISO(todayISO(), -days);
  return hist.filter((h) => h.date >= cutoff);
}

function ExerciseChart({ hist, metric }) {
  const data = hist.map((h) => ({ date: formatShortDate(h.date), value: metric === "volume" ? h.volume : metric === "weight" ? h.weight : h.reps }));
  if (data.length < 2) {
    return <div className="h-56 flex items-center justify-center text-sm text-slate-500">Log a couple more sessions to see this trend.</div>;
  }
  // With a wide range selected (e.g. "All" on a long history) there can be many points —
  // thin out dots and axis labels so the chart stays readable instead of a smear.
  // (Was gated on data.length > 30, which never fired for a history of
  // exactly 30 sessions — every label rendered and crumpled together.)
  const dense = data.length > 14;
  const maxTicks = 8;
  const tickInterval = data.length > 10 ? Math.ceil(data.length / maxTicks) - 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="exFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d16d94" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#d1935a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={tickInterval} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
        <Area type="monotone" dataKey="value" stroke="#d16d94" strokeWidth={2.5} fill="url(#exFill)" dot={dense ? false : { r: 3, fill: "#d16d94" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RangeChips({ range, onChange }) {
  return (
    <div className="flex gap-2">
      {HIST_RANGES.map((r) => <Chip key={r.id} active={range === r.id} onClick={() => onChange(r.id)}>{r.label}</Chip>)}
    </div>
  );
}

function ExerciseDetailPage({ exerciseId, me, onBack, onSaveNote, onSaveInstructions, onEditCustom, canEditCustom }) {
  const ex = getEx(exerciseId);
  const hist = (me.history[exerciseId] || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const stats = useMemo(() => exerciseStats(hist), [hist]);
  const [metric, setMetric] = useState("weight");
  const [range, setRange] = useState("all");
  const rangedHist = useMemo(() => filterHistByRange(hist, range), [hist, range]);
  const [note, setNote] = useState(me.exerciseNotes?.[exerciseId] || "");
  const noteSaved = useRef(note);
  const [instr, setInstr] = useState(ex?.instructions || "");
  const instrSaved = useRef(instr);
  const [editingMeta, setEditingMeta] = useState(false);
  const canEditMeta = ex?.custom && onEditCustom && (!canEditCustom || canEditCustom(ex));

  if (!ex) {
    return (
      <div className="flex flex-col gap-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit">
          <ArrowLeft size={16} /> Back
        </button>
        <EmptyState icon="❓" title="Exercise not found" sub="This exercise may have been removed from the shared library." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-3xl ${GRAD_DIAG} flex items-center justify-center text-3xl shadow-lg shadow-pink-400/20`}>{ex.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white truncate">{ex.name}</h1>
            {canEditMeta && (
              <button onClick={() => setEditingMeta(true)} aria-label="Edit exercise details" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-200 shrink-0">
                <Pencil size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">{ex.muscle}</span>
            {(ex.secondary || []).map((m) => (
              <span key={m} className="text-[11px] font-medium px-2 py-1 rounded-full bg-white/[0.03] text-slate-500 border border-white/5">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {canEditMeta && editingMeta && (
        <Card className="p-4">
          <CustomExerciseForm
            initial={ex}
            existingExercises={[]}
            onCancel={() => setEditingMeta(false)}
            onSaveEdit={(payload) => { onEditCustom(payload); setEditingMeta(false); }}
          />
        </Card>
      )}

      <Card className="p-5">
        <div className={`text-xs font-semibold tracking-wider uppercase mb-2 ${GRAD_TEXT}`}>Instructions</div>
        {ex.custom ? (
          <textarea
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            onBlur={() => { if (instrSaved.current !== instr) { onSaveInstructions(exerciseId, instr); instrSaved.current = instr; } }}
            placeholder="How to perform this exercise — setup, execution, cues…"
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none"
          />
        ) : (
          <p className="text-sm text-slate-300 leading-relaxed">{ex.instructions}</p>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock icon={<Trophy size={16} className="text-amber-400" />} label="Personal record" value={stats.pr ? `${stats.pr.weight}kg` : "—"} />
        <StatBlock icon={<Activity size={16} className="text-pink-400" />} label="Lifetime volume" value={`${stats.lifetime.toLocaleString()}kg`} />
        <StatBlock icon={<Calendar size={16} className="text-emerald-400" />} label="This week" value={`${stats.weekly.toLocaleString()}kg`} />
        <StatBlock icon={<BarChart3 size={16} className="text-emerald-400" />} label="This month" value={`${stats.monthly.toLocaleString()}kg`} />
      </div>

      <Card className="p-5">
        <SectionHeading eyebrow="Trend" title="Progress" />
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3 mb-4">
          <RangeChips range={range} onChange={setRange} />
          <div className="flex gap-2">
            {["weight", "volume", "reps"].map((m) => <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>{m[0].toUpperCase() + m.slice(1)}</Chip>)}
          </div>
        </div>
        <ExerciseChart hist={rangedHist} metric={metric} />
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionHeading eyebrow="History" title="Previous sessions" />
          <RangeChips range={range} onChange={setRange} />
        </div>
        {rangedHist.length === 0 ? (
          <p className="text-sm text-slate-500 mt-3">{hist.length === 0 ? "No sessions logged yet." : "No sessions in this range."}</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5 max-h-96 overflow-y-auto mt-2">
            {rangedHist.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400">{formatShortDate(h.date)}</span>
                <span className="text-slate-300">{h.sets}×{h.reps} @ {h.weight}kg</span>
                <span className="text-emerald-300 font-semibold">{h.volume}kg vol</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeading eyebrow="Notes" title="Your notes" />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (noteSaved.current !== note) { onSaveNote(exerciseId, note); noteSaved.current = note; } }}
          placeholder="Form cues, machine settings, how it felt…"
          rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none"
        />
      </Card>
    </div>
  );
}

/* ===================== Read-only exercise peek (other members) ============= */
// A lightweight modal — not a full page navigation — showing another member's
// stats/history/notes for one exercise. Reached by tapping an exercise inside
// their program modal. Deliberately read-only: no note/instruction editing,
// since this isn't "your" data.
function MemberExerciseModal({ exerciseId, member, onClose }) {
  const ex = exerciseId ? getEx(exerciseId) : null;
  const hist = useMemo(
    () => (exerciseId ? (member.history[exerciseId] || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : []),
    [exerciseId, member]
  );
  const stats = useMemo(() => exerciseStats(hist), [hist]);
  const [metric, setMetric] = useState("weight");
  const [range, setRange] = useState("all");
  const rangedHist = useMemo(() => filterHistByRange(hist, range), [hist, range]);

  return (
    <Modal open={!!exerciseId} onClose={onClose} title={ex?.name || "Exercise"} size="lg">
      {!ex ? (
        <EmptyState icon="❓" title="Exercise not found" sub="This exercise may have been removed from the shared library." />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${GRAD_DIAG} flex items-center justify-center text-2xl shrink-0`}>{ex.icon}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">{ex.muscle}</span>
                {(ex.secondary || []).map((m) => (
                  <span key={m} className="text-[11px] font-medium px-2 py-1 rounded-full bg-white/[0.03] text-slate-500 border border-white/5">{m}</span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{member.name}'s numbers for this exercise</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBlock icon={<Trophy size={16} className="text-amber-400" />} label="Personal record" value={stats.pr ? `${stats.pr.weight}kg` : "—"} />
            <StatBlock icon={<Activity size={16} className="text-pink-400" />} label="Lifetime volume" value={`${stats.lifetime.toLocaleString()}kg`} />
            <StatBlock icon={<Calendar size={16} className="text-emerald-400" />} label="This week" value={`${stats.weekly.toLocaleString()}kg`} />
            <StatBlock icon={<BarChart3 size={16} className="text-emerald-400" />} label="This month" value={`${stats.monthly.toLocaleString()}kg`} />
          </div>

          <div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <SectionHeading eyebrow="Trend" title="Progress" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2 mt-3 mb-3">
              <RangeChips range={range} onChange={setRange} />
              <div className="flex gap-2">
                {["weight", "volume", "reps"].map((m) => <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>{m[0].toUpperCase() + m.slice(1)}</Chip>)}
              </div>
            </div>
            <ExerciseChart hist={rangedHist} metric={metric} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <SectionHeading eyebrow="History" title="Previous sessions" />
              <RangeChips range={range} onChange={setRange} />
            </div>
            {rangedHist.length === 0 ? (
              <p className="text-sm text-slate-500 mt-3">{hist.length === 0 ? "No sessions logged yet." : "No sessions in this range."}</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/5 max-h-96 overflow-y-auto mt-2">
                {rangedHist.slice().reverse().map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-400">{formatShortDate(h.date)}</span>
                    <span className="text-slate-300">{h.sets}×{h.reps} @ {h.weight}kg</span>
                    <span className="text-emerald-300 font-semibold">{h.volume}kg vol</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {member.exerciseNotes?.[exerciseId] && (
            <div>
              <SectionHeading eyebrow="Notes" title={`${member.name}'s notes`} />
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{member.exerciseNotes[exerciseId]}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ================================ Programs ================================= */

function ProgramCard({ program, onActivate, onEdit, onDuplicate, onDelete }) {
  const workoutDays = DAY_ORDER.filter((d) => program.days[d]?.type === "workout");
  return (
    <Card className={`p-5 flex flex-col gap-4 ${program.active ? "ring-1 ring-pink-400/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold truncate">{program.name}</h3>
            {program.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">ACTIVE</span>}
          </div>
          {program.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{program.description}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAY_ORDER.map((d) => (
          <span key={d} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
            program.days[d]?.type === "workout" ? `${GRAD} text-white` : "bg-white/5 text-slate-500"
          }`}>{DAY_SHORT[d][0]}</span>
        ))}
      </div>
      <div className="text-xs text-slate-500">{workoutDays.length} workout day{workoutDays.length !== 1 ? "s" : ""} / week</div>
      <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-white/5">
        {!program.active && <GradientButton size="sm" onClick={() => onActivate(program.id)}><Zap size={14} /> Activate</GradientButton>}
        <GhostButton className="px-3 py-1.5 text-sm" onClick={() => onEdit(program.id)}><Pencil size={13} /> Edit</GhostButton>
        <GhostButton className="px-3 py-1.5 text-sm" onClick={() => onDuplicate(program.id)}><Copy size={13} /> Duplicate</GhostButton>
        <GhostButton className="px-3 py-1.5 text-sm" danger ariaLabel={`Delete ${program.name}`} onClick={() => onDelete(program.id)}><Trash2 size={13} /></GhostButton>
      </div>
    </Card>
  );
}

const LOAD_TYPE_LABEL = { external: "Weighted", bodyweight: "Bodyweight", cardio: "Cardio" };
const LOAD_TYPE_BADGE_CLASS = {
  external: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  bodyweight: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  cardio: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};
const CUSTOM_ICON_CHOICES = ["⭐", "🏋️", "🤸", "🦵", "💪", "🧘", "🚣", "🚴", "🏃", "🙆", "🧗"];

function CustomExerciseForm({ onCreate, onSaveEdit, onCancel, existingExercises = [], onUseExisting, initial = null }) {
  // When `initial` is set we're editing an already-existing custom exercise in place
  // (same id) rather than creating a new one. Because every screen in the app looks
  // exercise metadata up live via getEx(id) instead of copying it, saving here is all
  // that's needed — programs, history, and worklogs all pick up the change automatically.
  const isEditing = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [muscle, setMuscle] = useState(initial?.muscle || MAIN_MUSCLE_OPTIONS[0]);
  const [secondary, setSecondary] = useState(initial?.secondary || []);
  const [icon, setIcon] = useState(initial?.icon || CUSTOM_ICON_CHOICES[0]);
  const [loadType, setLoadType] = useState(initial?.loadType || "external");
  const [bwPercent, setBwPercent] = useState(initial?.bwPercent || 100);
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  // Guard against accidental duplicate library entries: if the typed name exactly
  // matches an exercise that already exists (built-in or custom), nudge toward
  // reusing it instead of creating a near-identical second copy. While editing,
  // the exercise being edited is excluded so it doesn't flag itself as a dupe.
  const duplicateMatch = name.trim()
    ? existingExercises.find((e) => e.id !== initial?.id && e.name.trim().toLowerCase() === name.trim().toLowerCase())
    : null;
  const canSave = name.trim().length > 0 && !duplicateMatch;
  const toggleSecondary = (m) => setSecondary((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  const secondaryOptions = [...MAIN_MUSCLE_OPTIONS.filter((m) => m !== muscle), ...MINOR_MUSCLE_OPTIONS];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-3 mb-3">
      <div className="text-xs font-semibold tracking-wider uppercase text-slate-400">{isEditing ? "Edit exercise" : "New custom exercise"}</div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise name"
        className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50" />

      {duplicateMatch && (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-xs text-amber-200">
          <span className="text-base shrink-0">{duplicateMatch.icon}</span>
          <span className="flex-1 min-w-0">"{duplicateMatch.name}" already exists in your library — reuse it instead of creating a duplicate.</span>
          {onUseExisting && (
            <button type="button" onClick={() => onUseExisting(duplicateMatch.id)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 font-semibold transition-colors">
              Use existing
            </button>
          )}
        </div>
      )}

      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">Main muscle group</div>
        <div className="flex flex-wrap gap-1.5">
          {MAIN_MUSCLE_OPTIONS.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => { setMuscle(m); setSecondary((prev) => prev.filter((x) => x !== m)); }} className="!px-2.5 !py-1 text-xs">{m}</Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">Also works (optional, pick as many as apply)</div>
        <div className="flex flex-wrap gap-1.5">
          {secondaryOptions.map((m) => (
            <Chip key={m} active={secondary.includes(m)} onClick={() => toggleSecondary(m)} className="!px-2.5 !py-1 text-xs">{m}</Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">Icon</div>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_ICON_CHOICES.map((ic) => (
            <button key={ic} type="button" onClick={() => setIcon(ic)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border transition-colors ${icon === ic ? "border-pink-400/60 bg-pink-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">How is it loaded?</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(LOAD_TYPE_LABEL).map(([lt, label]) => (
            <Chip key={lt} active={loadType === lt} onClick={() => setLoadType(lt)} className="!px-2.5 !py-1 text-xs">{label}</Chip>
          ))}
        </div>
        {loadType === "bodyweight" && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-slate-400">
            <span>Est. % of bodyweight moved</span>
            <NumberField value={bwPercent} onChange={setBwPercent} step={5} min={5} width="w-14" label="percent of bodyweight" />
            <span>%</span>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">Instructions (optional)</div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="How to perform this exercise — setup, execution, cues…"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        {isEditing ? (
          <GradientButton disabled={!canSave} onClick={() => onSaveEdit({ id: initial.id, name, muscle, secondary, icon, loadType, bwPercent, instructions })}>
            <Check size={14} /> Save changes
          </GradientButton>
        ) : (
          <GradientButton disabled={!canSave} onClick={() => onCreate({ name, muscle, secondary, icon, loadType, bwPercent, instructions })}>
            <Plus size={14} /> Create & add
          </GradientButton>
        )}
      </div>
    </div>
  );
}

function ExercisePicker({ open, onClose, onPick, excludeIds = [], customExercises = {}, onAddCustom, onEditCustom, onDeleteCustom, canDeleteCustom }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All");
  // formTarget: null (browsing list) | "new" (create form) | an exercise object (edit form)
  const [formTarget, setFormTarget] = useState(null);
  if (!open) return null;
  const excludeSet = new Set(excludeIds);
  const list = allExercises(customExercises);
  const filtered = list.filter((e) => {
    const matchesTab = tab === "All" ? true : tab === "Custom" ? !!e.custom : (e.muscle === tab || MUSCLE_TO_CATEGORY[e.muscle] === tab);
    const q_ = q.toLowerCase();
    const matchesQ = e.name.toLowerCase().includes(q_) || e.muscle.toLowerCase().includes(q_) || (e.secondary || []).some((m) => m.toLowerCase().includes(q_));
    return matchesTab && matchesQ;
  });
  const hasCustom = Object.keys(customExercises).length > 0;
  const editingExercise = formTarget && formTarget !== "new" ? formTarget : null;
  const showForm = formTarget !== null;

  return (
    <Modal open={open} onClose={() => { setFormTarget(null); onClose(); }} title="Add an exercise" size="lg">
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises or muscle…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
        {["All", ...MUSCLE_CATEGORIES, ...(hasCustom ? ["Custom"] : [])].map((m) => (
          <button key={m} onClick={() => setTab(m)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
              tab === m ? `${GRAD} text-white border-transparent shadow-md shadow-pink-400/30` : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}>
            {m}
          </button>
        ))}
      </div>

      {showForm ? (
        <CustomExerciseForm
          initial={editingExercise}
          existingExercises={list}
          onUseExisting={(id) => {
            setFormTarget(null);
            onPick(id);
            onClose();
          }}
          onCancel={() => setFormTarget(null)}
          onCreate={(payload) => {
            const id = onAddCustom(payload);
            setFormTarget(null);
            onPick(id);
            onClose();
          }}
          onSaveEdit={(payload) => {
            // Same id, updated fields — every program, history entry, and worklog that
            // references this exercise looks it up live, so they all reflect this instantly.
            onEditCustom?.(payload);
            setFormTarget(null);
          }}
        />
      ) : (
        <button onClick={() => setFormTarget("new")}
          className="w-full flex items-center gap-2 p-2.5 mb-2 rounded-xl border border-dashed border-white/15 text-sm text-slate-300 hover:bg-white/5 hover:border-white/25 transition-colors">
          <Plus size={15} className="text-pink-400" /> Create your own exercise
        </button>
      )}

      {!showForm && (
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1 -mx-2 px-2">
          {filtered.map((e) => {
            const already = excludeSet.has(e.id);
            const canManage = e.custom && canDeleteCustom?.(e);
            return (
              <div key={e.id} className="flex items-center gap-1">
                <button
                  disabled={already} onClick={() => { onPick(e.id); onClose(); }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors flex-1 min-w-0 ${already ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"}`}
                >
                  <span className="text-xl shrink-0">{e.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">{e.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{e.muscle}{e.secondary?.length ? ` · ${e.secondary.join(", ")}` : ""}</span>
                      <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${LOAD_TYPE_BADGE_CLASS[e.loadType] || LOAD_TYPE_BADGE_CLASS.external}`}>
                        {LOAD_TYPE_LABEL[e.loadType] || "Weighted"}
                      </span>
                    </div>
                  </div>
                  {already && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-400 shrink-0">Added</span>}
                </button>
                {onEditCustom && canManage && (
                  <button onClick={() => setFormTarget(e)} aria-label={`Edit custom exercise ${e.name}`} className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-slate-200 shrink-0">
                    <Pencil size={14} />
                  </button>
                )}
                {e.custom && onDeleteCustom && canManage && (
                  <button onClick={() => onDeleteCustom(e.id)} aria-label={`Delete custom exercise ${e.name}`} className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-300 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No exercises match.</p>}
        </div>
      )}
    </Modal>
  );
}

function BuilderExerciseRow({ pex, index, total, onChange, onRemove, onMove, onCopyToDays, onOpen, dragProps, bodyweightKg, sharedNote, onSaveNote }) {
  const ex = getEx(pex.exerciseId);
  const isCardio = ex?.loadType === "cardio";
  const [noteDraft, setNoteDraft] = useState(sharedNote || "");
  const noteSaved = useRef(sharedNote || "");
  useEffect(() => { setNoteDraft(sharedNote || ""); noteSaved.current = sharedNote || ""; }, [sharedNote, pex.exerciseId]);
  return (
    <div {...dragProps} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="cursor-grab text-slate-600 hover:text-slate-400 shrink-0" title="Drag to reorder"><GripVertical size={16} /></span>
        <button
          type="button" onClick={onOpen} disabled={!onOpen}
          className="min-w-0 flex-1 flex items-center gap-3 text-left rounded-lg -m-1 p-1 disabled:cursor-default enabled:hover:bg-white/[0.05] transition-colors"
          aria-label={`View ${ex?.name || "exercise"} details`} title={onOpen ? "View exercise details" : undefined}>
          <span className="text-xl shrink-0">{ex?.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white font-medium truncate">{ex?.name}</div>
            <div className="text-[11px] text-slate-500">{ex?.muscle}</div>
          </div>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${ex?.name || "exercise"} up`} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"><ChevronUp size={14} /></button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Move ${ex?.name || "exercise"} down`} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white disabled:opacity-20 disabled:pointer-events-none"><ChevronDown size={14} /></button>
          {onCopyToDays && (
            <button onClick={onCopyToDays} aria-label={`Copy ${ex?.name || "exercise"} to another day`} title="Copy to other days" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white"><Copy size={14} /></button>
          )}
          <button onClick={onRemove} aria-label={`Remove ${ex?.name || "exercise"}`} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 pl-7">
        <div className="flex items-center gap-1.5">Sets <NumberField value={pex.sets} onChange={(v) => onChange({ sets: v })} step={1} min={1} width="w-10" label="sets" /></div>
        <div className="flex items-center gap-1.5">Reps <NumberField value={pex.reps} onChange={(v) => onChange({ reps: v })} step={1} min={1} width="w-10" label="reps" /></div>
        {!isCardio && (
          <div className="flex items-center gap-1.5">
            {ex?.loadType === "bodyweight" ? "Target added wt" : "Target wt"}{" "}
            <LoadField
              ex={ex} weight={pex.targetWeight} addedWeight={pex.targetAddedWeight} bodyweightKg={bodyweightKg} done={false}
              onChange={(p) => onChange({ targetWeight: p.weight, targetAddedWeight: p.addedWeight })}
            />
          </div>
        )}
        <input
          value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteSaved.current !== noteDraft) {
              onSaveNote?.(pex.exerciseId, noteDraft);
              noteSaved.current = noteDraft;
            }
          }}
          placeholder="Notes (optional)" title="Shared with this exercise's notes everywhere it's used"
          className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-1 focus:ring-pink-400/50" />
      </div>
    </div>
  );
}

function ProgramEditor({ initial, onSave, onCancel, onDelete, customExercises, onAddCustom, onEditCustom, onDeleteCustom, bodyweightKg, me, onSaveNote, onSaveInstructions }) {
  const [draft, setDraft] = useState(initial);
  const [selectedDay, setSelectedDay] = useState("mon");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewExerciseId, setViewExerciseId] = useState(null);
  const dragIndex = useRef(null);

  const dayData = draft.days[selectedDay];

  const setDayType = (type) => setDraft((d) => ({ ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], type } } }));
  const patchExercise = (idx, patch) => setDraft((d) => {
    const list = d.days[selectedDay].exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    return { ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], exercises: list } } };
  });
  const removeExercise = (idx) => setDraft((d) => {
    const list = d.days[selectedDay].exercises.filter((_, i) => i !== idx);
    return { ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], exercises: list } } };
  });
  const addExercise = (exerciseId) => setDraft((d) => {
    const ex = getEx(exerciseId);
    // If this exercise is already scheduled on another day in this program, reuse its
    // sets/reps/weight as the starting point instead of resetting to generic defaults
    // — keeps the same exercise consistent across the days it's used on. Notes are
    // NOT copied here because they aren't a per-slot field at all: they live in the
    // single shared me.exerciseNotes[exerciseId] store and are already the same
    // everywhere this exercise appears (see BuilderExerciseRow's sharedNote).
    const priorDay = DAY_ORDER.find((dayKey) => dayKey !== selectedDay && (d.days[dayKey]?.exercises || []).some((e) => e.exerciseId === exerciseId));
    const prior = priorDay ? d.days[priorDay].exercises.find((e) => e.exerciseId === exerciseId) : null;
    const base = prior
      ? { id: uid("pex"), exerciseId, sets: prior.sets, reps: prior.reps }
      : { id: uid("pex"), exerciseId, sets: 3, reps: 10 };
    const pex = ex?.loadType === "bodyweight" ? { ...base, targetAddedWeight: prior ? (prior.targetAddedWeight ?? 0) : 0 }
      : ex?.loadType === "cardio" ? { ...base, targetWeight: prior ? (prior.targetWeight ?? 0) : 0 }
      : { ...base, targetWeight: prior ? (prior.targetWeight ?? 20) : 20 };
    const list = [...d.days[selectedDay].exercises, pex];
    return { ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], exercises: list } } };
  });
  const moveExercise = (idx, dir) => setDraft((d) => {
    const list = [...d.days[selectedDay].exercises];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return d;
    [list[idx], list[j]] = [list[j], list[idx]];
    return { ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], exercises: list } } };
  });
  const dropReorder = (idx) => {
    if (dragIndex.current === null || dragIndex.current === idx) return;
    setDraft((d) => {
      const list = [...d.days[selectedDay].exercises];
      const [moved] = list.splice(dragIndex.current, 1);
      list.splice(idx, 0, moved);
      return { ...d, days: { ...d.days, [selectedDay]: { ...d.days[selectedDay], exercises: list } } };
    });
    dragIndex.current = null;
  };

  // ---- Copy an exercise (with its current sets/reps/weight/notes) to other days ----
  const [copySourceIdx, setCopySourceIdx] = useState(null);
  const [copyDays, setCopyDays] = useState([]);
  const openCopyModal = (idx) => { setCopySourceIdx(idx); setCopyDays([]); };
  const closeCopyModal = () => { setCopySourceIdx(null); setCopyDays([]); };
  const toggleCopyDay = (day) => setCopyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  const copySourcePex = copySourceIdx !== null ? dayData.exercises[copySourceIdx] : null;
  const confirmCopy = () => {
    if (!copySourcePex || copyDays.length === 0) return;
    setDraft((d) => {
      let nextDays = d.days;
      copyDays.forEach((day) => {
        const list = nextDays[day]?.exercises || [];
        const existingIdx = list.findIndex((e) => e.exerciseId === copySourcePex.exerciseId);
        const cloned = { ...copySourcePex, id: existingIdx >= 0 ? list[existingIdx].id : uid("pex") };
        const nextList = existingIdx >= 0 ? list.map((e, i) => (i === existingIdx ? cloned : e)) : [...list, cloned];
        // Adding an exercise to a rest day implicitly turns it into a workout day.
        nextDays = { ...nextDays, [day]: { ...nextDays[day], type: "workout", exercises: nextList } };
      });
      return { ...d, days: nextDays };
    });
    closeCopyModal();
  };

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit">
        <ArrowLeft size={16} /> Back to programs
      </button>

      <Card className="p-5 flex flex-col gap-3">
        <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Program name"
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400/50" />
        <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description (optional)" rows={2}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none" />
      </Card>

      <Card className="p-5">
        <SectionHeading eyebrow="Weekly planner" title="Set your week" />
        <div className="grid grid-cols-7 gap-2">
          {DAY_ORDER.map((d) => (
            <button key={d} onClick={() => setSelectedDay(d)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all duration-200 ${
                selectedDay === d ? "border-pink-400/50 bg-pink-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}>
              <span className="text-[11px] font-bold text-slate-300">{DAY_SHORT[d]}</span>
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${draft.days[d]?.type === "workout" ? `${GRAD}` : "bg-white/10"}`}>
                {draft.days[d]?.type === "workout" ? <Dumbbell size={12} className="text-white" /> : <span className="text-[11px]">🌙</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-slate-400">{DAY_LABEL[selectedDay]}:</span>
          <Chip active={dayData.type === "workout"} onClick={() => setDayType("workout")}>Workout day</Chip>
          <Chip active={dayData.type === "rest"} onClick={() => setDayType("rest")}>Rest day</Chip>
        </div>
      </Card>

      {dayData.type === "workout" && (
        <Card className="p-5">
          <SectionHeading eyebrow="Workout builder" title={`${DAY_LABEL[selectedDay]} exercises`}
            right={<GradientButton size="sm" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add exercise</GradientButton>} />
          {dayData.exercises.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No exercises yet — add your first one above.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {dayData.exercises.map((pex, i) => (
                <BuilderExerciseRow
                  key={pex.id} pex={pex} index={i} total={dayData.exercises.length} bodyweightKg={bodyweightKg}
                  sharedNote={me.exerciseNotes?.[pex.exerciseId] || ""} onSaveNote={onSaveNote}
                  onChange={(p) => patchExercise(i, p)} onRemove={() => removeExercise(i)} onMove={(dir) => moveExercise(i, dir)}
                  onCopyToDays={() => openCopyModal(i)} onOpen={() => setViewExerciseId(pex.exerciseId)}
                  dragProps={{
                    draggable: true,
                    onDragStart: () => (dragIndex.current = i),
                    onDragOver: (e) => e.preventDefault(),
                    onDrop: () => dropReorder(i),
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <ExercisePicker
        open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} excludeIds={dayData.exercises.map((e) => e.exerciseId)}
        customExercises={customExercises} onAddCustom={onAddCustom} onEditCustom={onEditCustom} onDeleteCustom={onDeleteCustom}
        canDeleteCustom={(e) => !e.createdBy || e.createdBy === me?.id || me?.role === "admin"}
      />

      <Modal open={!!viewExerciseId} onClose={() => setViewExerciseId(null)} title="Exercise details" size="lg">
        {viewExerciseId && (
          <ExerciseDetailPage
            exerciseId={viewExerciseId} me={me} onBack={() => setViewExerciseId(null)}
            onSaveNote={onSaveNote} onSaveInstructions={onSaveInstructions}
            onEditCustom={onEditCustom} canEditCustom={(e) => !e.createdBy || e.createdBy === me?.id || me?.role === "admin"}
          />
        )}
      </Modal>

      <div className="flex items-center justify-between gap-3 pb-4">
        {onDelete ? <GhostButton danger onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete program</GhostButton> : <span />}
        <div className="flex gap-3">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <GradientButton onClick={() => onSave(draft)} disabled={!draft.name.trim()}><Save size={16} /> Save program</GradientButton>
        </div>
      </div>

      <Modal
        open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this program?"
        footer={<>
          <GhostButton onClick={() => setConfirmDelete(false)}>Cancel</GhostButton>
          <GhostButton danger onClick={onDelete}>Delete</GhostButton>
        </>}
      >
        {`"${draft.name || "This program"}" and its full weekly plan will be permanently removed. This can't be undone.`}
      </Modal>

      <Modal
        open={copySourceIdx !== null} onClose={closeCopyModal} title="Copy to other days"
        footer={<>
          <GhostButton onClick={closeCopyModal}>Cancel</GhostButton>
          <GradientButton disabled={copyDays.length === 0} onClick={confirmCopy}>
            <Copy size={14} /> Copy to {copyDays.length || ""} day{copyDays.length === 1 ? "" : "s"}
          </GradientButton>
        </>}
      >
        {copySourcePex && (
          <>
            <p className="text-sm text-slate-400 mb-3">
              Send <span className="text-white font-medium">{getEx(copySourcePex.exerciseId)?.name}</span> — with its current sets, reps, weight, and notes — to:
            </p>
            <div className="flex flex-wrap gap-2">
              {DAY_ORDER.filter((d) => d !== selectedDay).map((d) => {
                const already = draft.days[d]?.exercises?.some((e) => e.exerciseId === copySourcePex.exerciseId);
                const active = copyDays.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleCopyDay(d)}
                    className={`flex flex-col items-center gap-0.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                      active ? `${GRAD} text-white border-transparent shadow-md shadow-pink-400/30` : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                    }`}>
                    {DAY_SHORT[d]}
                    {already && <span className={`text-[9px] font-medium ${active ? "text-white/80" : "text-amber-300/80"}`}>update</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function ProgramsPage({ me, programs, onActivate, onSaveProgram, onDuplicate, onDelete, customExercises, onAddCustom, onEditCustom, onDeleteCustom, onSaveNote, onSaveInstructions }) {
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const mine = Object.values(programs).filter((p) => p.ownerId === me.id);

  if (creating || editingId) {
    const initial = creating ? { id: uid("prog"), ownerId: me.id, name: "", description: "", active: mine.length === 0, days: emptyWeek() } : programs[editingId];
    return (
      <ProgramEditor
        initial={initial}
        onCancel={() => { setCreating(false); setEditingId(null); }}
        onDelete={editingId ? () => { onDelete(editingId); setEditingId(null); } : null}
        onSave={(draft) => { onSaveProgram(draft); setCreating(false); setEditingId(null); }}
        customExercises={customExercises} onAddCustom={onAddCustom} onEditCustom={onEditCustom} onDeleteCustom={onDeleteCustom} bodyweightKg={me.bodyweightKg} me={me} onSaveNote={onSaveNote}
        onSaveInstructions={onSaveInstructions}
      />
    );
  }

  const deleteTarget = confirmDeleteId ? programs[confirmDeleteId] : null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Build" title="Your programs" right={<GradientButton onClick={() => setCreating(true)}><Plus size={16} /> New program</GradientButton>} />
      {mine.length === 0 ? (
        <EmptyState icon="📋" title="No programs yet" sub="Create your first program, plan your week, and activate it to start training." action={<GradientButton onClick={() => setCreating(true)}><Plus size={16} /> Create a program</GradientButton>} />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {mine.map((p) => (
            <ProgramCard key={p.id} program={p} onActivate={onActivate} onEdit={setEditingId} onDuplicate={onDuplicate} onDelete={setConfirmDeleteId} />
          ))}
        </div>
      )}

      <Modal
        open={!!deleteTarget} onClose={() => setConfirmDeleteId(null)} title="Delete this program?"
        footer={<>
          <GhostButton onClick={() => setConfirmDeleteId(null)}>Cancel</GhostButton>
          <GhostButton danger onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}>Delete</GhostButton>
        </>}
      >
        {`"${deleteTarget?.name || "This program"}" and its full weekly plan will be permanently removed. This can't be undone.`}
      </Modal>
    </div>
  );
}

/* ================================ Members =================================== */

function PendingRow({ m, onApprove, onReject }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
      <Avatar name={m.name} swatch={m.avatar} photoUrl={m.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white font-semibold truncate">{m.name}</div>
        <div className="text-[11px] text-amber-400">Requested {formatShortDate(m.joinedAt)}</div>
      </div>
      <button onClick={() => onReject(m.id)} aria-label={`Reject ${m.name}`} className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 transition-colors" title="Reject"><UserX size={16} /></button>
      <button onClick={() => onApprove(m.id)} aria-label={`Approve ${m.name}`} className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-300 transition-colors" title="Approve"><UserCheck size={16} /></button>
    </div>
  );
}

function MemberRow({ m, me, rank, sortKey, onOpen, programs }) {
  const prog = m.activeProgramId ? programs[m.activeProgramId] : null;
  return (
    <button onClick={() => onOpen(m.id)} className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all duration-200 text-left">
      <span className={`w-6 text-sm font-bold shrink-0 ${rank === 0 ? "text-amber-400" : rank === 1 ? "text-slate-300" : rank === 2 ? "text-orange-400" : "text-slate-600"}`}>{rank + 1}</span>
      <Avatar name={m.name} swatch={m.avatar} photoUrl={m.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white font-semibold truncate flex items-center gap-1.5">
          {m.id === me.id ? "You" : m.name}
          {m.role === "admin" && <ShieldCheck size={13} className="text-emerald-400" />}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{prog ? prog.name : "No active program"}</div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-orange-400 shrink-0"><Flame size={13} /> {m.streak}</div>
      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold shrink-0 w-16 justify-end">
        <Star size={13} className="text-amber-400" /> {sortKey === "streak" ? m.streak : m.xp}
      </div>
      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </button>
  );
}

function MembersPage({ me, members, programs, onOpen, onApprove, onReject, onRefresh, refreshing }) {
  const [sortKey, setSortKey] = useState("xp");
  const pending = Object.values(members).filter((m) => m.status === "pending");
  const approved = Object.values(members).filter((m) => m.status === "approved").sort((a, b) => sortKey === "xp" ? b.xp - a.xp : b.streak - a.streak);

  return (
    <div className="flex flex-col gap-6">
      {me.role === "admin" && pending.length > 0 && (
        <Card className="p-5 border-amber-500/20">
          <SectionHeading eyebrow="Admin" title={`Pending approval (${pending.length})`} />
          <div className="flex flex-col gap-2.5">
            {pending.map((m) => <PendingRow key={m.id} m={m} onApprove={onApprove} onReject={onReject} />)}
          </div>
        </Card>
      )}

      <SectionHeading eyebrow="Crew" title="Members" right={
        <div className="flex items-center gap-2">
          <Chip active={sortKey === "xp"} onClick={() => setSortKey("xp")}>By XP</Chip>
          <Chip active={sortKey === "streak"} onClick={() => setSortKey("streak")}>By streak</Chip>
          <button
            onClick={onRefresh} disabled={refreshing} aria-label="Refresh members list"
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      } />
      <div className="flex flex-col gap-2.5">
        {approved.map((m, i) => <MemberRow key={m.id} m={m} me={me} rank={i} sortKey={sortKey} onOpen={onOpen} programs={programs} />)}
      </div>
    </div>
  );
}

/* ============================ Member profile ================================ */

function aggregateVolumeByDate(member) {
  const map = {};
  Object.values(member.history || {}).forEach((arr) => arr.forEach((h) => { map[h.date] = (map[h.date] || 0) + h.volume; }));
  return Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(-10).map(([date, vol]) => ({ date: formatShortDate(date), vol }));
}

function MemberProfilePage({ member, me, programs, onBack, onRemove, onCopyProgram }) {
  const lvl = levelInfo(member.xp);
  const program = member.activeProgramId ? programs[member.activeProgramId] : null;
  const volData = useMemo(() => aggregateVolumeByDate(member), [member]);
  const recentDays = useMemo(() => Object.entries(member.worklogs || {}).filter(([, v]) => v.completedAt).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, 6), [member]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(() => DAY_FROM_JS[new Date().getDay()]);
  const [peekExerciseId, setPeekExerciseId] = useState(null);
  const isOtherMember = member.id !== me.id;
  const openProgram = (day) => {
    if (day) setActiveDay(day);
    setProgramOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit">
        <ArrowLeft size={16} /> Back to members
      </button>

      <Card className="p-6 flex flex-wrap items-center gap-6">
        <Avatar name={member.name} swatch={member.avatar} photoUrl={member.avatarUrl} size="lg" ring />
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">{member.name}{member.role === "admin" && <ShieldCheck size={18} className="text-emerald-400" />}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
              {goalInfo(member.goal).icon} {goalInfo(member.goal).label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
              {dietGoalInfo(member.dietGoal).icon} {dietGoalInfo(member.dietGoal).label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center"><span className="text-xl font-bold text-orange-400 flex items-center gap-1"><Flame size={18} />{member.streak}</span><span className="text-[10px] text-slate-500">streak</span></div>
          <div className="flex flex-col items-center"><span className="text-xl font-bold text-amber-300 flex items-center gap-1"><Star size={18} />{lvl.level}</span><span className="text-[10px] text-slate-500">level</span></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock icon={<Activity size={16} className="text-pink-400" />} label="Total volume" value={`${member.totalVolume.toLocaleString()}kg`} />
        <StatBlock icon={<ListChecks size={16} className="text-emerald-400" />} label="Workouts done" value={member.totalWorkouts} />
        <StatBlock icon={<Trophy size={16} className="text-amber-400" />} label="Longest streak" value={`${member.longestStreak}d`} />
        <StatBlock icon={<TrendingUp size={16} className="text-emerald-400" />} label="Personal records" value={member.prCount} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock icon={<Scale size={16} className="text-fuchsia-400" />} label="Current weight" value={`${currentWeightKg(member)}kg`} />
        <StatBlock icon={<Flame size={16} className="text-orange-400" />} label="Today's calories" value={`${totalKcalForDay(member, todayISO())} kcal`} />
        <StatBlock icon={<Target size={16} className="text-pink-400" />} label="Calorie target (est.)" value={`${calorieTargetFor(member)} kcal`} />
        <StatBlock icon={<Footprints size={16} className="text-sky-400" />} label="Steps today" value={(activityForDay(member, todayISO()).steps || 0).toLocaleString()} />
      </div>

      {program && (
        <Card
          className="p-5 cursor-pointer hover:bg-white/[0.07] transition-colors group"
          onClick={() => openProgram()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProgram(); } }}
          aria-label={`View ${program.name} program and exercises`}
        >
          <SectionHeading
            eyebrow="Training"
            title={program.name}
            right={<ChevronRight size={18} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />}
          />
          {program.description && <p className="text-sm text-slate-400 mb-3">{program.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((d) => {
              const sched = program.days[d];
              const isWorkout = sched?.type === "workout";
              return (
                <button
                  key={d}
                  onClick={(e) => { e.stopPropagation(); openProgram(d); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 ${isWorkout ? `${GRAD} text-white` : "bg-white/5 text-slate-500"}`}
                  aria-label={`View ${DAY_SHORT[d]} — ${isWorkout ? `${(sched.exercises || []).length} exercises` : "rest day"}`}
                >{DAY_SHORT[d][0]}</button>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-3">Tap to view the full program & exercises</div>
        </Card>
      )}

      {program && (
        <Modal
          open={programOpen} onClose={() => setProgramOpen(false)} title={program.name} size="lg"
          footer={isOtherMember ? (
            <GradientButton onClick={() => { onCopyProgram(program.id); setProgramOpen(false); }}>
              <Copy size={14} /> Copy to my programs
            </GradientButton>
          ) : null}
        >
          {program.description && <p className="text-sm text-slate-400 mb-4 -mt-1">{program.description}</p>}
          {isOtherMember && (
            <p className="text-[11px] text-slate-500 mb-4 -mt-2">
              Tap an exercise to see {member.name}'s numbers. Copying keeps your own sets/reps/weight for any exercise already in one of your programs.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {DAY_ORDER.map((d) => {
              const sched = program.days[d];
              const isWorkout = sched?.type === "workout";
              const isActive = activeDay === d;
              return (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-colors ${
                    isActive ? `${GRAD} text-white border-transparent` : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span>{DAY_SHORT[d]}</span>
                  <span className={`text-[9px] font-normal ${isActive ? "opacity-90" : "opacity-60"}`}>
                    {isWorkout ? `${(sched.exercises || []).length} ex` : "Rest"}
                  </span>
                </button>
              );
            })}
          </div>

          {(() => {
            const sched = program.days[activeDay];
            const exercises = sched?.type === "workout" ? (sched.exercises || []) : [];
            if (exercises.length === 0) {
              return (
                <div className="py-10 flex flex-col items-center text-center gap-2 text-slate-500">
                  <span className="text-3xl">🌙</span>
                  <p className="text-sm">Rest day — no exercises scheduled.</p>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-2.5">
                {exercises.map((pex, i) => {
                  const ex = getEx(pex.exerciseId);
                  const isCardio = ex?.loadType === "cardio";
                  const isBW = ex?.loadType === "bodyweight";
                  return (
                    <button
                      key={pex.id || i}
                      onClick={() => setPeekExerciseId(pex.exerciseId)}
                      aria-label={`View ${member.name}'s data for ${ex?.name || "this exercise"}`}
                      className="w-full text-left rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 hover:bg-white/[0.07] transition-colors p-3.5 flex items-center gap-3"
                    >
                      <span className="text-xl shrink-0">{ex?.icon || "🏋️"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white font-medium truncate">{ex?.name || "Unknown exercise"}</div>
                        <div className="text-[11px] text-slate-500">{ex?.muscle}</div>
                        {member.exerciseNotes?.[pex.exerciseId] && <div className="text-[11px] text-slate-500 italic mt-0.5 truncate">{member.exerciseNotes[pex.exerciseId]}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0 text-xs">
                        <span className="font-semibold text-white">{pex.sets} × {pex.reps}</span>
                        {!isCardio && (
                          <span className="text-slate-500">
                            {isBW ? (pex.targetAddedWeight ? `+${pex.targetAddedWeight}kg` : "Bodyweight") : `${pex.targetWeight ?? 0}kg`}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={15} className="text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </Modal>
      )}

      <MemberExerciseModal exerciseId={peekExerciseId} member={member} onClose={() => setPeekExerciseId(null)} />

      <Card className="p-5">
        <SectionHeading eyebrow="Trend" title="Volume over time" />
        {volData.length < 2 ? <p className="text-sm text-slate-500">Not enough sessions yet to chart.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="vol" fill="#d1935a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Same "Trends & analytics" card the member sees on their own Diet tab —
          reused as-is here so anyone in the crew can check in on someone else's
          nutrition/weight/activity trends, not just their training. */}
      <DietHistorySection me={member} />

      <Card className="p-5">
        <SectionHeading eyebrow="Badges" title="Achievements" />
        <AchievementsGrid unlockedIds={member.unlocked || []} />
      </Card>

      {recentDays.length > 0 && (
        <Card className="p-5">
          <SectionHeading eyebrow="History" title="Recent sessions" />
          <div className="flex flex-col divide-y divide-white/5">
            {recentDays.map(([date, log]) => (
              <div key={date} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400">{formatShortDate(date)}</span>
                <span className="text-slate-300">{Object.keys(log.exercises || {}).length} exercises</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {me.role === "admin" && member.id !== me.id && (
        <Card className="p-5 border-rose-500/20">
          <SectionHeading eyebrow="Admin" title="Danger zone" />
          {!confirmRemove ? (
            <GhostButton danger onClick={() => setConfirmRemove(true)}><Trash2 size={14} /> Remove member</GhostButton>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400 flex-1">Remove {member.name} from KBL? This can't be undone.</p>
              <GhostButton onClick={() => setConfirmRemove(false)}>Cancel</GhostButton>
              <GhostButton danger onClick={() => onRemove(member.id)}>Confirm remove</GhostButton>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ================================= Profile =================================== */

// Resizes/compresses an image file client-side before it's stored, so avatars and
// progress photos stay well under storage limits regardless of the original camera
// resolution. Returns a JPEG data URL.
function readAndResizeImage(file, maxDim = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function AvatarUploadButton({ onUpload }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await readAndResizeImage(file, 400, 0.85);
      onUpload(dataUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        aria-label="Change avatar photo" title="Change avatar photo"
        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border border-white/20 hover:bg-white/10 text-white flex items-center justify-center transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
      </button>
    </>
  );
}

// Lets the user pick one of the preset goals, or type their own free-text goal.
// Custom goals are stored as plain strings (see goalInfo()) instead of a preset id.
function GoalPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const menuRef = useRef(null);
  const display = goalInfo(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // The dropdown is portaled to <body> (see below) so it can't be trapped behind a
  // sibling card's own stacking context (e.g. cards using backdrop-blur). Since it's
  // portaled out of normal flow, we position it manually from the trigger's rect.
  useEffect(() => {
    if (!open || !ref.current) return;
    const updatePos = () => {
      const rect = ref.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, left: rect.left });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  const pick = (v) => { onChange(v); setOpen(false); };
  const submitCustom = () => {
    const t = customText.trim();
    if (!t) return;
    onChange(t);
    setCustomText("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
      >
        <span>{display.icon}</span>
        <span className="font-medium">{display.label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
          className="z-[9999] w-64 rounded-2xl bg-slate-900 border border-white/10 shadow-xl p-2 flex flex-col gap-1"
        >
          {GOALS.map((g) => (
            <button
              key={g.id} type="button" onClick={() => pick(g.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-colors ${value === g.id ? `${GRAD} text-white` : "text-slate-300 hover:bg-white/5"}`}
            >
              <span>{g.icon}</span> {g.label}
            </button>
          ))}
          <div className="border-t border-white/10 mt-1 pt-2 flex items-center gap-1.5">
            <input
              value={customText} onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitCustom(); } }}
              placeholder="Write your own…"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-400/50"
            />
            <button
              type="button" onClick={submitCustom} disabled={!customText.trim()} aria-label="Use custom goal"
              className="w-7 h-7 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 flex items-center justify-center"
            >
              <Check size={13} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function isoFromYMD(y, mIdx, d) {
  return `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// A real month-grid calendar (not just a heatmap strip): navigate between months,
// and click any date to jump to that day's workout / see what was logged.
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthCalendar({ me, program, onSelectDate }) {
  const todayIso = todayISO();
  const [cursor, setCursor] = useState(() => {
    const t = isoToDate(todayIso);
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(cursor.y);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setPickerOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onEsc); };
  }, [pickerOpen]);

  const openPicker = () => { setPickerYear(cursor.y); setPickerOpen((v) => !v); };
  const jumpToMonth = (mIdx) => { setCursor({ y: pickerYear, m: mIdx }); setPickerOpen(false); };
  const jumpToToday = () => { const t = isoToDate(todayIso); setCursor({ y: t.getFullYear(), m: t.getMonth() }); setPickerOpen(false); };

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstWeekday = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // 0 = Monday

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const statusFor = (iso) => {
    const log = me.worklogs[iso];
    if (log?.completedAt) {
      const vol = Object.values(log.exercises || {}).reduce((s, e) => s + volumeOf(e.sets, e.reps, e.weight), 0);
      if (vol > 1500) return "logged-high";
      if (vol > 600) return "logged-mid";
      return "logged-low";
    }
    const key = dayKeyForISO(iso);
    if (program?.days?.[key]?.type === "rest" || !program) return "rest";
    if (iso > todayIso) return "future";
    // Today's own scheduled workout isn't "missed" until the day is actually
    // over — it just hasn't been logged yet. Give it a distinct pending state
    // instead of lumping it in with genuinely missed past days.
    if (iso === todayIso) return "today-pending";
    if (program?.days?.[key]?.type === "workout") return "missed";
    return "none";
  };

  const cellClass = {
    "logged-high": `${GRAD} text-white border-transparent`,
    "logged-mid": "bg-pink-400/50 text-white border-transparent",
    "logged-low": "bg-pink-400/25 text-white border-transparent",
    rest: "bg-white/5 text-slate-400 border-white/5",
    missed: "bg-rose-500/10 text-rose-300/80 border-rose-500/10",
    "today-pending": "bg-amber-400/10 text-amber-200 border-amber-400/30",
    future: "bg-transparent text-slate-600 border-white/5",
    none: "bg-white/[0.03] text-slate-500 border-white/5",
  };

  const goPrev = () => setCursor((c) => { const d = new Date(c.y, c.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goNext = () => setCursor((c) => { const d = new Date(c.y, c.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 relative">
        <button onClick={goPrev} aria-label="Previous month" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center">
          <ChevronLeft size={15} />
        </button>
        <button
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          className="text-sm font-semibold text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          {monthLabel}
        </button>
        <button onClick={goNext} aria-label="Next month" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center">
          <ChevronRight size={15} />
        </button>

        {pickerOpen && (
          <div
            ref={pickerRef}
            role="dialog"
            aria-label="Jump to month"
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20 w-64 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40 p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYear((y) => y - 1)}
                aria-label="Previous year"
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-semibold text-white">{pickerYear}</span>
              <button
                onClick={() => setPickerYear((y) => y + 1)}
                aria-label="Next year"
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {MONTH_SHORT.map((mLabel, mIdx) => {
                const isSelected = pickerYear === cursor.y && mIdx === cursor.m;
                return (
                  <button
                    key={mLabel}
                    onClick={() => jumpToMonth(mIdx)}
                    className={`text-xs font-medium rounded-lg py-2 transition-colors ${
                      isSelected ? `${GRAD} text-white` : "bg-white/[0.03] text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {mLabel}
                  </button>
                );
              })}
            </div>
            <button
              onClick={jumpToToday}
              className="w-full text-xs font-semibold text-center text-pink-300 hover:text-pink-200 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Today
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-500 mb-1.5">
        {DAY_ORDER.map((d) => <span key={d}>{DAY_SHORT[d]}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const iso = isoFromYMD(cursor.y, cursor.m, d);
          const status = statusFor(iso);
          const isToday = iso === todayIso;
          return (
            <button
              key={iso} onClick={() => onSelectDate(iso)} aria-label={`View ${formatNiceDate(iso)}`}
              className={`aspect-square rounded-xl border text-xs font-semibold flex items-center justify-center transition-transform hover:scale-105 ${cellClass[status]} ${isToday ? "ring-2 ring-white/50" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Trigger button only. The confirm/note modal is rendered separately at the
// top level of ProfilePage (see PhotoUploadPreviewModal) so it isn't nested
// inside a backdrop-blur Card, which would trap its stacking context and let
// later Cards (e.g. the admin banner) paint on top of it.
function PhotoUploadButton({ busy, onPick, inputRef, onFile }) {
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <GradientButton onClick={onPick} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {busy ? "Processing…" : "Add progress photo"}
      </GradientButton>
    </>
  );
}

function PhotoUploadPreviewModal({ pendingUrl, note, setNote, date, setDate, onSave, onCancel }) {
  useLockBodyScroll(true);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-lg max-h-[85dvh] min-h-0 overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <SectionHeading eyebrow="Transformation" title="Add progress photo" />
        <img src={pendingUrl} alt="New progress photo preview" className="w-full max-h-[40vh] object-contain rounded-2xl border border-white/10 bg-black/30" />
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Date taken</label>
          <div className="relative">
            <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="date" value={date} max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Date the photo was taken"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 [color-scheme:dark]"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Defaults to today — back-date it if you took this earlier and are uploading it now.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Note (optional)</label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="How are you feeling? Anything you noticed…"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <GradientButton onClick={onSave}><Save size={14} /> Save photo</GradientButton>
        </div>
      </div>
    </div>
  );
}

// Fullscreen viewer for a progress photo: click-to-zoom, download, prev/next
// between photos, and an editable note shown under the date.
function PhotoLightbox({ photos, index, onIndex, onClose, onDelete, onUpdateNote, onUpdateDate }) {
  const [zoomed, setZoomed] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const photo = photos[index];
  useLockBodyScroll(true);

  useEffect(() => {
    setZoomed(false);
    setEditingNote(false);
    setEditingDate(false);
    setNoteDraft(photo?.note || "");
  }, [photo?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndex]);

  if (!photo) return null;

  const download = () => {
    const a = document.createElement("a");
    a.href = photo.dataUrl;
    a.download = `progress-${photo.date}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-full min-h-0 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between w-full gap-2">
          {editingDate ? (
            <input
              type="date" autoFocus value={photo.date} max={todayISO()}
              aria-label="Edit photo date"
              onChange={(e) => { if (e.target.value) { onUpdateDate(photo.id, e.target.value); } }}
              onBlur={() => setEditingDate(false)}
              className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 [color-scheme:dark]"
            />
          ) : onUpdateDate ? (
            <button
              onClick={() => setEditingDate(true)}
              className="flex items-center gap-1.5 text-sm text-slate-300 font-semibold hover:text-white transition-colors"
              aria-label="Edit photo date"
            >
              {formatNiceDate(photo.date)} <Pencil size={12} className="text-slate-500" />
            </button>
          ) : (
            <span className="text-sm text-slate-300 font-semibold">{formatNiceDate(photo.date)}</span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={download} aria-label="Download photo" title="Download" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
              <Download size={15} />
            </button>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative w-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40" style={{ maxHeight: "56vh" }}>
          {index > 0 && (
            <button onClick={() => onIndex(index - 1)} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center z-10">
              <ChevronLeft size={18} />
            </button>
          )}
          <img
            src={photo.dataUrl} alt={`Progress photo from ${photo.date}`}
            onClick={() => setZoomed((z) => !z)}
            className={`max-h-[56vh] transition-transform duration-300 ${zoomed ? "scale-[1.8] cursor-zoom-out" : "cursor-zoom-in"}`}
          />
          {index < photos.length - 1 && (
            <button onClick={() => onIndex(index + 1)} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center z-10">
              <ChevronRight size={18} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 -mt-1.5">Tap the photo to zoom</p>

        <div className="w-full">
          {editingNote ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} autoFocus placeholder="Add a note about this photo…"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400/50 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <GhostButton onClick={() => { setNoteDraft(photo.note || ""); setEditingNote(false); }}>Cancel</GhostButton>
                <GradientButton size="sm" onClick={() => { onUpdateNote(photo.id, noteDraft.trim()); setEditingNote(false); }}><Save size={14} /> Save note</GradientButton>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingNote(true)} className="w-full text-left px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
              {photo.note ? (
                <span className="text-sm text-slate-300">{photo.note}</span>
              ) : (
                <span className="text-sm text-slate-500 flex items-center gap-1.5"><Pencil size={12} /> Add a note</span>
              )}
            </button>
          )}
        </div>

        <GhostButton danger onClick={() => { onDelete(photo.id); onClose(); }} className="w-fit"><Trash2 size={14} /> Delete photo</GhostButton>
      </div>
    </div>
  );
}

function ProfilePage({ me, programs, photos, onUpdate, onAddPhoto, onDeletePhoto, onUpdatePhotoNote, onUpdatePhotoDate, onSignOut, goTo, onSelectDate }) {
  const [name, setName] = useState(me.name);
  const lvl = levelInfo(me.xp);
  const program = me.activeProgramId ? programs[me.activeProgramId] : null;
  const sortedPhotos = [...photos].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const [compare, setCompare] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState(null);
  const [pendingPhotoNote, setPendingPhotoNote] = useState("");
  const [pendingPhotoDate, setPendingPhotoDate] = useState(todayISO());

  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await readAndResizeImage(file, 1000, 0.85);
      setPendingPhotoUrl(dataUrl);
      setPendingPhotoNote("");
      // Default to today, but the person can back-date it — they may have taken
      // the photo earlier and only got around to uploading it just now.
      setPendingPhotoDate(todayISO());
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePendingPhoto = () => {
    onAddPhoto(pendingPhotoUrl, pendingPhotoNote.trim(), pendingPhotoDate);
    setPendingPhotoUrl(null);
    setPendingPhotoNote("");
  };

  // Editing a photo's date changes its position in the date-sorted list, so keep
  // the lightbox pointed at the same photo (not the same index) after it moves.
  const handleLightboxDateChange = (id, date) => {
    onUpdatePhotoDate(id, date);
    const resorted = photos
      .map((p) => (p.id === id ? { ...p, date } : p))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const newIdx = resorted.findIndex((p) => p.id === id);
    if (newIdx >= 0) setLightboxIndex(newIdx);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="You" title="Profile" />

      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="relative shrink-0">
            <Avatar name={me.name} swatch={me.avatar} photoUrl={me.avatarUrl} size="lg" ring />
            <AvatarUploadButton onUpload={(dataUrl) => onUpdate({ avatarUrl: dataUrl })} />
          </div>
          <div className="flex-1 min-w-[200px] flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Display name</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/50" />
              {name !== me.name && <GradientButton size="sm" onClick={() => onUpdate({ name })}><Save size={14} /> Save</GradientButton>}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Workout goal</label>
          <GoalPicker value={me.goal} onChange={(v) => onUpdate({ goal: v })} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-5">
          <div className="min-w-0">
            <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Bodyweight</label>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <NumberField value={me.bodyweightKg ?? DEFAULT_BODYWEIGHT_KG} onChange={(v) => onUpdate({ bodyweightKg: v })} step={1} min={20} width="w-11 sm:w-20" label="bodyweight in kilograms" />
              <span className="text-xs sm:text-sm text-slate-400">kg</span>
            </div>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Height</label>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <NumberField value={me.heightCm ?? DEFAULT_HEIGHT_CM} onChange={(v) => onUpdate({ heightCm: v })} step={1} min={100} width="w-11 sm:w-20" label="height in centimeters" />
              <span className="text-xs sm:text-sm text-slate-400">cm</span>
            </div>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">Age</label>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <NumberField value={me.age ?? DEFAULT_AGE} onChange={(v) => onUpdate({ age: v })} step={1} min={10} width="w-11 sm:w-20" label="age in years" />
              <span className="text-xs sm:text-sm text-slate-400">yrs</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">Bodyweight is used to estimate the load on bodyweight exercises like push-ups and pull-ups, so they show up on your volume and PR charts alongside weighted lifts.</p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock icon={<Activity size={16} className="text-pink-400" />} label="Total volume" value={`${me.totalVolume.toLocaleString()}kg`} />
        <StatBlock icon={<Star size={16} className="text-amber-400" />} label={`Level ${lvl.level} · XP`} value={me.xp} />
        <StatBlock icon={<Flame size={16} className="text-orange-400" />} label="Current streak" value={`${me.streak}d`} />
        <StatBlock icon={<Trophy size={16} className="text-emerald-400" />} label="Longest streak" value={`${me.longestStreak}d`} />
      </div>

      <Card className="p-5">
        <SectionHeading eyebrow="Consistency" title="Workout calendar" />
        <MonthCalendar me={me} program={program} onSelectDate={onSelectDate} />
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[4px] bg-white/[0.03]" /> No session</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[4px] bg-white/5" /> Rest day</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[4px] bg-amber-400/10 border border-amber-400/30" /> Today</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[4px] bg-rose-500/10" /> Missed</span>
          <span className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-[4px] ${GRAD}`} /> Workout logged</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Tap any date to jump to that day's workout.</p>
      </Card>

      <Card className="p-5">
        <SectionHeading eyebrow="Badges" title="Achievements" />
        <AchievementsGrid unlockedIds={me.unlocked || []} />
      </Card>

      <Card className="p-5">
        <SectionHeading
          eyebrow="Transformation" title="Progress photos"
          right={
            <PhotoUploadButton
              busy={photoBusy} inputRef={photoInputRef}
              onPick={() => photoInputRef.current?.click()} onFile={handlePhotoFile}
            />
          }
        />
        {sortedPhotos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Upload your first photo to start tracking your transformation over time.</p>
        ) : (
          <>
            {sortedPhotos.length >= 2 && (
              <Chip active={compare} onClick={() => setCompare((c) => !c)} className="mb-4">{compare ? "Show all" : "Compare first vs. latest"}</Chip>
            )}
            {compare && sortedPhotos.length >= 2 ? (
              <div className="grid grid-cols-2 gap-4">
                {[0, sortedPhotos.length - 1].map((idx) => {
                  const p = sortedPhotos[idx];
                  return (
                    <div key={p.id} className="flex flex-col gap-2 cursor-pointer" onClick={() => setLightboxIndex(idx)}>
                      <img src={p.dataUrl} className="w-full aspect-[3/4] object-cover rounded-2xl border border-white/10 hover:border-white/25 transition-colors" />
                      <span className="text-xs text-slate-400 text-center">{idx === 0 ? "First" : "Latest"} · {formatShortDate(p.date)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {sortedPhotos.map((p, i) => (
                  <div key={p.id} className="shrink-0 w-28 group cursor-pointer" onClick={() => setLightboxIndex(i)}>
                    <div className="relative">
                      <img src={p.dataUrl} className="w-28 h-36 object-cover rounded-2xl border border-white/10 group-hover:border-white/25 transition-colors" />
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/70 text-slate-200">{formatShortDate(p.date)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeletePhoto(p.id); }}
                        aria-label={`Delete photo from ${formatShortDate(p.date)}`}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-950/70 text-slate-300 hover:text-rose-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    {p.note && <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">{p.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={sortedPhotos} index={lightboxIndex}
          onIndex={setLightboxIndex} onClose={() => setLightboxIndex(null)}
          onDelete={onDeletePhoto} onUpdateNote={onUpdatePhotoNote}
          onUpdateDate={onUpdatePhotoDate ? handleLightboxDateChange : undefined}
        />
      )}

      {pendingPhotoUrl && (
        <PhotoUploadPreviewModal
          pendingUrl={pendingPhotoUrl} note={pendingPhotoNote} setNote={setPendingPhotoNote}
          date={pendingPhotoDate} setDate={setPendingPhotoDate}
          onSave={savePendingPhoto} onCancel={() => setPendingPhotoUrl(null)}
        />
      )}

      {me.role === "admin" && (
        <Card className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-400" />
            <div>
              <div className="text-sm text-white font-semibold">You're the admin</div>
              <div className="text-xs text-slate-500">Approve, reject, or remove members from the Members page.</div>
            </div>
          </div>
          <GhostButton onClick={() => goTo("members")}>Go to Members <ChevronRight size={14} /></GhostButton>
        </Card>
      )}

      <GhostButton danger onClick={onSignOut} className="w-fit"><LogOut size={15} /> Sign out</GhostButton>
    </div>
  );
}

/* =================================== Root =================================== */

const GLOBAL_STYLES = `
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes popIn { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
@keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
@keyframes slideRight { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes moonFloat { 0%, 100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-10px) rotate(4deg) } }
@keyframes moonGlow { 0%, 100% { opacity: 0.5; transform: scale(0.92) } 50% { opacity: 1; transform: scale(1.08) } }
@keyframes restGradientDrift { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.grad-brand { background-image: linear-gradient(90deg,#d16d94,#d1935a,#c9ad55,#5fa87e,#5a9fb3,#8b7fc2); }
.grad-brand-diag { background-image: linear-gradient(135deg,#d16d94,#d1935a,#c9ad55,#5fa87e,#5a9fb3,#8b7fc2); }
.grad-brand-text { background-image: linear-gradient(90deg,#d16d94,#d1935a,#c9ad55,#5fa87e,#5a9fb3,#8b7fc2); -webkit-background-clip: text; background-clip: text; color: transparent; }
.grad-warm { background-image: linear-gradient(90deg,#d1935a,#d16d94,#c9ad55); }
`;

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <style>{GLOBAL_STYLES}</style>
      <div className="flex flex-col items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl ${GRAD} animate-pulse flex items-center justify-center text-white`}>◆</div>
        <span className="text-slate-500 text-sm">Loading KBL…</span>
      </div>
    </div>
  );
}

function completeExerciseOnMember(m, finalizedInst, allInstances, program) {
  const iso = todayISO();
  let next = { ...m };
  const vol = volumeOf(finalizedInst.sets, finalizedInst.reps, finalizedInst.weight);
  const hist = upsertHistoryEntry(next.history[finalizedInst.exerciseId] || [], iso, {
    sets: finalizedInst.sets, reps: finalizedInst.reps, weight: finalizedInst.weight, addedWeight: finalizedInst.addedWeight, volume: vol,
  });
  next.history = { ...next.history, [finalizedInst.exerciseId]: hist };

  const wl = next.worklogs[iso] || { exercises: {} };
  const exercises = { ...wl.exercises, [finalizedInst.exerciseId]: { sets: finalizedInst.sets, reps: finalizedInst.reps, weight: finalizedInst.weight, addedWeight: finalizedInst.addedWeight, done: true, isPR: finalizedInst.isPR } };

  let xpGain = 15 + (finalizedInst.isPR ? 10 : 0);
  next.totalVolume = (next.totalVolume || 0) + vol;
  next.prCount = (next.prCount || 0) + (finalizedInst.isPR ? 1 : 0);

  const allDone = allInstances.every((i) => i.done);
  let completedAt = wl.completedAt;
  if (allDone && !wl.completedAt) {
    completedAt = Date.now();
    next.totalWorkouts = (next.totalWorkouts || 0) + 1;
    xpGain += 50;
  }
  next.worklogs = { ...next.worklogs, [iso]: { ...wl, exercises, completedAt } };
  next = applyStreak(next, program);
  next.xp = (next.xp || 0) + xpGain;
  next.level = levelInfo(next.xp).level;
  next.unlocked = recomputeAchievements(next);
  return { next, xpGain, allDone };
}

// Insert/replace a history entry for a specific date, keeping the array sorted
// chronologically (existing entries are always date-ordered since they're
// normally appended for "today"; editing an arbitrary past date can otherwise
// leave the array out of order, which would throw off anything — like the
// exercise trend chart — that reads the tail as "most recent").
function upsertHistoryEntry(hist, iso, entry) {
  const idx = hist.findIndex((h) => h.date === iso);
  let next;
  if (idx >= 0) {
    next = [...hist];
    next[idx] = { ...next[idx], ...entry, date: iso };
  } else {
    next = [...hist, { date: iso, ...entry }];
  }
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return next;
}
function removeHistoryEntry(hist, iso) {
  return hist.filter((h) => h.date !== iso);
}

// Recompute PR flags for one exercise's entire history in true chronological
// order (each entry is a PR iff it beats every strictly-earlier entry).
// Needed because calendar edits can insert/remove a date out of order — e.g.
// backfilling a forgotten session that turns out heavier than a "PR" you'd
// already logged later — which a single-date comparison can't catch.
// `originalWorklogs` (the member's worklogs *before* this edit) is used only
// to compute the old PR count for the totals delta; `workingWorklogs` (which
// already reflects the in-progress add/edit/remove) is what gets patched with
// the corrected flags and returned.
function recomputeExercisePRFlags(originalWorklogs, workingWorklogs, exerciseId, sortedHist) {
  let worklogs = workingWorklogs;
  let runningMax = -Infinity;
  let oldPRCount = 0;
  let newPRCount = 0;
  sortedHist.forEach((h) => {
    const isPRNow = h.weight > runningMax;
    if (h.weight > runningMax) runningMax = h.weight;
    if (originalWorklogs[h.date]?.exercises?.[exerciseId]?.isPR) oldPRCount++;
    if (isPRNow) newPRCount++;
    const wl = worklogs[h.date];
    const curEntry = wl?.exercises?.[exerciseId];
    if (curEntry && curEntry.isPR !== isPRNow) {
      worklogs = { ...worklogs, [h.date]: { ...wl, exercises: { ...wl.exercises, [exerciseId]: { ...curEntry, isPR: isPRNow } } } };
    }
  });
  return { worklogs, prDelta: newPRCount - oldPRCount };
}

// Log or edit a single exercise's numbers for an arbitrary date (past, present,
// or otherwise), used by the Day Detail page reached from the calendar. This
// mirrors completeExerciseOnMember/handleEditDone and — like that flow — the
// streak is recomputed from the full worklog history afterward, so a session
// backfilled here (e.g. logging yesterday's forgotten workout today) is
// treated exactly as if it had been logged on time.
// (Program-target syncing is handled separately by the caller via
// syncProgramToLatestLog, since that should follow the latest log by date
// rather than by which page made the edit.)
function upsertWorklogEntryForDate(m, iso, exerciseId, patch, sched, program) {
  const hist = m.history[exerciseId] || [];
  const existingIdx = hist.findIndex((h) => h.date === iso);
  const oldVol = existingIdx >= 0 ? hist[existingIdx].volume : 0;
  const newVol = volumeOf(patch.sets, patch.reps, patch.weight);
  const newHist = upsertHistoryEntry(hist, iso, {
    sets: patch.sets, reps: patch.reps, weight: patch.weight, addedWeight: patch.addedWeight, volume: newVol,
  });

  const wl = m.worklogs[iso] || { exercises: {} };
  const wasLogged = !!wl.exercises?.[exerciseId];
  const exercisesWithEntry = {
    ...wl.exercises,
    [exerciseId]: { sets: patch.sets, reps: patch.reps, weight: patch.weight, addedWeight: patch.addedWeight, done: true, isPR: false },
  };
  const workingWorklogs = { ...m.worklogs, [iso]: { ...wl, exercises: exercisesWithEntry } };

  const { worklogs: worklogsAfterPR, prDelta } = recomputeExercisePRFlags(m.worklogs, workingWorklogs, exerciseId, newHist);
  const wlAfter = worklogsAfterPR[iso];

  let completedAt = wl.completedAt;
  let workoutsDelta = 0;
  const allDoneNow = sched?.type === "workout" ? (sched.exercises || []).every((e) => wlAfter.exercises[e.exerciseId]) : false;
  if (allDoneNow && !wl.completedAt) { completedAt = Date.now(); workoutsDelta = 1; }
  else if (!allDoneNow && wl.completedAt) { completedAt = null; workoutsDelta = -1; }

  const xpDelta = prDelta * 10 + (wasLogged ? 0 : 15) + workoutsDelta * 50;

  let next = {
    ...m,
    history: { ...m.history, [exerciseId]: newHist },
    worklogs: { ...worklogsAfterPR, [iso]: { ...wlAfter, completedAt } },
    totalVolume: Math.max(0, (m.totalVolume || 0) - oldVol + newVol),
    prCount: Math.max(0, (m.prCount || 0) + prDelta),
    totalWorkouts: Math.max(0, (m.totalWorkouts || 0) + workoutsDelta),
    xp: Math.max(0, (m.xp || 0) + xpDelta),
  };
  next = applyStreak(next, program);
  next.level = levelInfo(next.xp).level;
  next.unlocked = recomputeAchievements(next);
  const newIsPR = next.worklogs[iso].exercises[exerciseId].isPR;
  return { next, newIsPR, workoutsDelta };
}

// Revert a logged exercise on an arbitrary date back to "not logged" — undoes
// exactly what upsertWorklogEntryForDate would have added, nothing else, and
// re-checks whether removing this entry hands the PR badge to a different
// date. The streak is recomputed afterward too, since un-logging a session
// can retroactively break a streak that was counting on it.
function clearWorklogEntryForDate(m, iso, exerciseId, program) {
  const wl = m.worklogs[iso];
  const entry = wl?.exercises?.[exerciseId];
  if (!entry) return { next: m, changed: false };

  const hist = m.history[exerciseId] || [];
  const idx = hist.findIndex((h) => h.date === iso);
  const oldVol = idx >= 0 ? hist[idx].volume : 0;

  const newHist = removeHistoryEntry(hist, iso);
  const exercisesWithoutEntry = { ...wl.exercises };
  delete exercisesWithoutEntry[exerciseId];
  const workingWorklogs = { ...m.worklogs, [iso]: { ...wl, exercises: exercisesWithoutEntry } };

  const { worklogs: worklogsAfterPR, prDelta } = recomputeExercisePRFlags(m.worklogs, workingWorklogs, exerciseId, newHist);
  const wlAfter = worklogsAfterPR[iso];

  let completedAt = wl.completedAt;
  let workoutsDelta = 0;
  if (wl.completedAt) { completedAt = null; workoutsDelta = -1; }

  const xpDelta = prDelta * 10 - 15 + workoutsDelta * 50;

  let next = {
    ...m,
    history: { ...m.history, [exerciseId]: newHist },
    worklogs: { ...worklogsAfterPR, [iso]: { ...wlAfter, completedAt } },
    totalVolume: Math.max(0, (m.totalVolume || 0) - oldVol),
    prCount: Math.max(0, (m.prCount || 0) + prDelta),
    totalWorkouts: Math.max(0, (m.totalWorkouts || 0) + workoutsDelta),
    xp: Math.max(0, (m.xp || 0) + xpDelta),
  };
  next = applyStreak(next, program);
  next.level = levelInfo(next.xp).level;
  next.unlocked = recomputeAchievements(next);
  return { next, changed: true };
}

// Keep a program's planned sets/reps/target weight in sync with what was
// actually logged, so the Program tab always shows the numbers from the
// latest previous log — not whatever was typed in when the program was
// first built, and not stale numbers left over from an earlier session.
//
// `hist` is the member's full (chronologically sorted, see
// upsertHistoryEntry) history array for `exerciseId`; its last entry is
// always the latest log for that exercise, regardless of which page/date
// produced it. Every occurrence of that exercise across every day of the
// program is updated to match — e.g. an exercise scheduled on both "Push"
// and "Legs" days stays consistent everywhere it appears, and a log made or
// edited from the calendar's Day Detail page (any date) is picked up too.
function syncProgramToLatestLog(program, exerciseId, hist) {
  if (!program || !exerciseId || !hist || hist.length === 0) return program;
  // Don't assume array order — find the entry with the max date explicitly,
  // so this stays correct even if history was ever built or imported out of
  // chronological order.
  const latest = hist.reduce((best, h) => (!best || h.date > best.date ? h : best), null);
  if (!latest) return program;
  let changed = false;
  const days = { ...program.days };
  for (const dayKey of Object.keys(days)) {
    const day = days[dayKey];
    if (!day || day.type !== "workout" || !(day.exercises || []).some((e) => e.exerciseId === exerciseId)) continue;
    const exercises = day.exercises.map((pex) => {
      if (pex.exerciseId !== exerciseId) return pex;
      const nextPex = {
        ...pex,
        sets: latest.sets ?? pex.sets,
        reps: latest.reps ?? pex.reps,
        targetWeight: latest.weight ?? pex.targetWeight,
        targetAddedWeight: latest.addedWeight !== undefined ? latest.addedWeight : pex.targetAddedWeight,
      };
      const unchanged =
        nextPex.sets === pex.sets &&
        nextPex.reps === pex.reps &&
        nextPex.targetWeight === pex.targetWeight &&
        nextPex.targetAddedWeight === pex.targetAddedWeight;
      if (!unchanged) changed = true;
      return unchanged ? pex : nextPex;
    });
    days[dayKey] = { ...day, exercises };
  }
  if (!changed) return program;
  return { ...program, days };
}

// Apply syncProgramToLatestLog across every program owned by `ownerId` — not
// just whichever one happens to be active. A member can have several
// programs (only one "active" for scheduling purposes), and any of them can
// have its own Program tab open; all of them should reflect the latest log
// for an exercise they contain, not just the active one. Returns the same
// `programs` reference if nothing actually changed, so callers can cheaply
// check `updated !== programs` to decide whether a write is needed.
function syncAllOwnedProgramsToLatestLog(programs, ownerId, exerciseId, hist) {
  if (!programs || !exerciseId || !hist || hist.length === 0) return programs;
  let changed = false;
  const next = { ...programs };
  for (const id of Object.keys(programs)) {
    const p = programs[id];
    if (!p || p.ownerId !== ownerId) continue;
    const updated = syncProgramToLatestLog(p, exerciseId, hist);
    if (updated !== p) {
      next[id] = updated;
      changed = true;
    }
  }
  return changed ? next : programs;
}

/* ================================= Diet tab ================================ */
// Everything below only reads/writes the member fields added in newMember()/
// normalizeState() above (foodLog, activityLog, weightHistory, sex,
// activityLevel, calorieTargetOverride) plus the shared customFoods map — no
// parallel data store, per spec §20/§21.

function DietDateNav({ iso, onChange, me }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isToday = iso === todayISO();
  return (
    <div className="flex items-center justify-between gap-3">
      <button onClick={() => onChange(addDaysISO(iso, -1))} aria-label="Previous day" className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
        <ChevronLeft size={18} />
      </button>
      <div className="text-center">
        <button
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="flex items-center gap-1.5 text-white font-bold text-base px-2.5 py-1 rounded-xl hover:bg-white/5 transition-colors mx-auto"
        >
          <Calendar size={14} className="text-slate-500" />
          {isToday ? "Today" : formatNiceDate(iso)}
        </button>
        {!isToday && (
          <button onClick={() => onChange(todayISO())} className="text-[11px] text-pink-300 hover:text-pink-200 mt-0.5 block mx-auto">
            Jump to today
          </button>
        )}
      </div>
      <button
        onClick={() => onChange(addDaysISO(iso, 1))} aria-label="Next day" disabled={iso >= todayISO()}
        className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronRight size={18} />
      </button>

      <DietDatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        iso={iso}
        me={me}
        onSelect={(d) => { onChange(d); setPickerOpen(false); }}
      />
    </div>
  );
}

// Full calendar month-grid for jumping straight to any date's diet log —
// tapping "previous day" one at a time to get back to, say, last month is
// too manual. Mirrors MonthCalendar's look/feel (spec-consistent design
// tokens) but simpler: no workout-completion coloring, just a small dot
// under days that already have something logged, the selected day
// highlighted, and future days disabled (there's nothing to log yet).
function DietDatePickerModal({ open, onClose, iso, me, onSelect }) {
  const todayIso = todayISO();
  const [cursor, setCursor] = useState(() => {
    const t = isoToDate(iso || todayIso);
    return { y: t.getFullYear(), m: t.getMonth() };
  });

  // Re-sync the visible month to whichever date is currently selected every
  // time the picker (re)opens, so it never opens showing a stale month left
  // over from the last time it was used.
  useEffect(() => {
    if (!open) return;
    const t = isoToDate(iso || todayIso);
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstWeekday = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // 0 = Monday

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => setCursor((c) => { const d = new Date(c.y, c.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goNext = () => setCursor((c) => { const d = new Date(c.y, c.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <Modal open={open} onClose={onClose} title="Jump to date">
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} aria-label="Previous month" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-white">{monthLabel}</span>
        <button onClick={goNext} aria-label="Next month" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-500 mb-1.5">
        {DAY_ORDER.map((d) => <span key={d}>{DAY_SHORT[d]}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const cellIso = isoFromYMD(cursor.y, cursor.m, d);
          const isFuture = cellIso > todayIso;
          const isSelected = cellIso === iso;
          const isToday = cellIso === todayIso;
          const hasLog = (me?.foodLog?.[cellIso]?.length || 0) > 0;
          return (
            <button
              key={cellIso}
              onClick={() => onSelect(cellIso)}
              disabled={isFuture}
              aria-label={formatNiceDate(cellIso)}
              className={`relative aspect-square rounded-xl border text-xs font-semibold flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-30 disabled:pointer-events-none disabled:hover:scale-100 ${
                isSelected ? `${GRAD} text-white border-transparent` : "bg-white/[0.03] text-slate-300 border-white/5"
              } ${isToday && !isSelected ? "ring-2 ring-white/30" : ""}`}
            >
              {d}
              {hasLog && !isSelected && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-pink-400" />}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect(todayIso)}
        className="w-full text-xs font-semibold text-center text-pink-300 hover:text-pink-200 py-2 mt-3 rounded-lg hover:bg-white/5 transition-colors"
      >
        Jump to today
      </button>
    </Modal>
  );
}

// Never lets a database-derived number look identical to a guess (spec §28).
function SourceBadge({ source }) {
  const map = {
    database: { label: "Database", cls: "bg-white/5 text-slate-400 border-white/10" },
    estimate: { label: "Estimated", cls: "bg-amber-500/10 text-amber-300 border-amber-500/25" },
    manual: { label: "Manual", cls: "bg-sky-500/10 text-sky-300 border-sky-500/25" },
  };
  const m = map[source] || map.database;
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${m.cls}`}>{m.label}</span>;
}

// One slim macro progress bar (consumed vs suggested target). Overshooting
// doesn't turn red the way overshooting calories does — going over a single
// macro (protein especially) isn't the problem overshooting total calories
// is, so this only communicates progress, never "you did something wrong".
function MacroBar({ label, grams, targetGrams, color, barOnly = false }) {
  const pct = targetGrams > 0 ? clamp((grams / targetGrams) * 100, 0, 100) : 0;
  if (barOnly) {
    return (
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden" role="progressbar" aria-label={`${label} progress`} aria-valuenow={grams} aria-valuemax={targetGrams}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    );
  }
  return (
    <div className="flex-1 min-w-[90px]">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-400">{label}</span>
        <span className="text-[11px] text-slate-500">{grams}<span className="text-slate-600">/{targetGrams}g</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Same target/consumed/remaining pattern as the calorie StatBlocks above, but
// for a single macro (protein/carbs/fat) — so every macro gets exactly the
// same at-a-glance treatment calories already had, not just protein. Grams
// are always shown (never hidden behind a "do we have data" gate) since
// missing macro data on some entries just means "counted as 0g from that
// entry", the same way missing kcal never happens but *would* just be 0 —
// consistent with how the calorie ring above already works.
function MacroTargetGroup({ label, icon, color, consumed, target }) {
  const remaining = target - consumed;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>{icon}</span>
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
        <StatBlock icon={<Target size={16} style={{ color }} />} label={`${label} target (est.)`} value={`${target}g`} />
        <StatBlock icon={<Flame size={16} style={{ color }} />} label="Consumed" value={`${consumed}g`} />
        <StatBlock
          icon={<Activity size={16} style={{ color }} />} label={remaining >= 0 ? "Remaining" : "Over target"}
          value={`${Math.abs(remaining)}g`} accent={remaining < 0 ? "text-rose-300" : "text-white"}
        />
      </div>
      <MacroBar label={label} grams={consumed} targetGrams={target} color={color} barOnly />
    </div>
  );
}

function DailySummaryCard({ me, iso, entries, target }) {
  const consumed = entries.reduce((s, e) => s + (e.kcal || 0), 0);
  const remaining = target - consumed;
  const activity = activityForDay(me, iso);
  const workout = workoutSummaryForDay(me, iso);
  const weight = weightOnDate(me, iso);
  const activityKcal = estimatedActivityKcal(me, iso);
  const pct = target > 0 ? clamp((consumed / target) * 100, 0, 100) : 0;
  const macros = macrosForDay(me, iso);
  const macroTargets = macroTargetsFor(me);
  // Grams are known for database-sourced entries automatically, and
  // optionally for estimate/manual entries when a protein amount was entered
  // for them. An entry with kcal but no macro info just contributes 0g to
  // the totals below (same as macrosForDay does) — this note only appears
  // as a heads-up that the macro totals may be an undercount, not to hide
  // the numbers the way earlier versions of this card did.
  const hasMacroData = entries.some((e) => e.protein != null || e.carbs != null || e.fat != null);
  const hasPartialMacroData = entries.length > 0 && !hasMacroData;

  return (
    <Card className="p-5 md:p-6">
      <div className={`text-xs font-semibold tracking-wider uppercase mb-4 ${GRAD_TEXT}`}>Today's summary</div>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ProgressRing
          pct={pct} size={104} stroke={10}
          center={
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black leading-none ${remaining < 0 ? "text-rose-300" : "text-white"}`}>{Math.abs(remaining)}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{remaining >= 0 ? "kcal left" : "over target"}</span>
            </div>
          }
        />
        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatBlock icon={<Target size={16} className="text-pink-400" />} label="Calorie target (est.)" value={`${target}`} />
          <StatBlock icon={<Flame size={16} className="text-orange-400" />} label="Consumed" value={`${consumed}`} />
          <StatBlock
            icon={<Activity size={16} className="text-emerald-400" />} label={remaining >= 0 ? "Remaining" : "Over target"}
            value={`${Math.abs(remaining)}`} accent={remaining < 0 ? "text-rose-300" : "text-white"}
          />
          <StatBlock icon={<Footprints size={16} className="text-sky-400" />} label="Steps" value={(activity.steps || 0).toLocaleString()} />
          <StatBlock icon={<Dumbbell size={16} className="text-amber-400" />} label="Workout" value={workout.completed ? (workout.minutes ? `${workout.minutes} min` : "Done ✓") : "—"} />
          <StatBlock icon={<Scale size={16} className="text-fuchsia-400" />} label="Weight" value={`${weight}kg`} />
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-5 pt-5 border-t border-white/5">
        <MacroTargetGroup label="Protein" icon={<Zap size={13} className="text-pink-400" />} color="#f472b6" consumed={round1(macros.protein)} target={macroTargets.proteinG} />
        <MacroTargetGroup label="Carbs" icon={<Wheat size={13} className="text-sky-400" />} color="#38bdf8" consumed={round1(macros.carbs)} target={macroTargets.carbsG} />
        <MacroTargetGroup label="Fat" icon={<Droplet size={13} className="text-amber-400" />} color="#fbbf24" consumed={round1(macros.fat)} target={macroTargets.fatG} />
      </div>
      {hasPartialMacroData && (
        <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1.5">
          <Info size={11} className="shrink-0" /> Today's entries don't have protein/carb/fat data yet, so the macro totals above read as 0g. Log a food from the database, or add an estimated protein amount to an estimate/manual entry, for a real breakdown.
        </p>
      )}
      {activityKcal > 0 && (
        <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1.5">
          <Info size={11} className="shrink-0" /> ~{activityKcal} kcal estimated burned from today's steps/workout — not subtracted from your target above.
        </p>
      )}
    </Card>
  );
}

function DietQuickActions({ onAddFood, onEstimateMeal, onAddWeight, onAddActivity }) {
  const items = [
    { label: "Add food", icon: <UtensilsCrossed size={18} className="text-pink-400" />, onClick: onAddFood },
    { label: "Estimate meal", icon: <Sparkles size={18} className="text-amber-400" />, onClick: onEstimateMeal },
    { label: "Add weight", icon: <Scale size={18} className="text-fuchsia-400" />, onClick: onAddWeight },
    { label: "Add activity", icon: <Footprints size={18} className="text-sky-400" />, onClick: onAddActivity },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {items.map((it) => (
        <button
          key={it.label} onClick={it.onClick}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-slate-200 transition-all duration-200"
        >
          {it.icon}
          <span className="text-xs font-semibold">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function FoodEntryRow({ entry, food, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(entry.amount);
  const [kcalDraft, setKcalDraft] = useState(entry.kcal);
  // For a database entry this mirrors entry.protein exactly (read-only —
  // recalculated from the food + amount on save). For estimate/manual
  // entries it's the editable "estimated protein" grams for this entry.
  const [proteinDraft, setProteinDraft] = useState(entry.protein ?? 0);
  const canRecalc = entry.source === "database" && !!food;

  const startEdit = () => { setAmount(entry.amount); setKcalDraft(entry.kcal); setProteinDraft(entry.protein ?? 0); setEditing(true); };
  const save = () => {
    if (canRecalc) {
      const stats = computeFoodStats(food, amount, entry.unit);
      onUpdate({ amount, ...stats });
    } else {
      // A protein amount left at 0 is treated as "not specified" rather than
      // "this food truly has 0g protein", same reasoning as the kcal=0 case
      // below — only an intentionally-entered positive value counts as data.
      onUpdate({
        kcal: Math.round(Number(kcalDraft) || 0),
        protein: Number(proteinDraft) > 0 ? round1(Number(proteinDraft)) : null,
        source: entry.source === "database" ? "manual" : entry.source,
      });
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
      <span className="text-lg shrink-0">{food?.icon || "🍽️"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-white font-medium truncate">{entry.name}</span>
          <SourceBadge source={entry.source} />
        </div>
        {!editing ? (
          <div className="text-[11px] text-slate-500 mt-0.5">
            {entry.amount} {entry.unit} · ≈{entry.kcal} kcal
            {/* Each macro shown independently — a manual/estimate entry may
                have a known protein amount with carbs/fat still unknown, so
                assuming all three are present together would print "Cnull
                Fnull" for those entries. */}
            {entry.protein != null && <span className="text-pink-300/90"> · P{entry.protein}g</span>}
            {entry.carbs != null && <span> C{entry.carbs}g</span>}
            {entry.fat != null && <span> F{entry.fat}g</span>}
            {entry.note ? ` · ${entry.note}` : ""}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {canRecalc ? (
              <>
                <NumberField value={amount} onChange={setAmount} step={food.baseUnit === "g" || food.baseUnit === "ml" ? 10 : 1} min={0} width="w-16" label={`${entry.name} amount`} />
                <span className="text-xs text-slate-400">{entry.unit}</span>
                <span className="text-xs text-slate-400">≈ {computeFoodStats(food, amount, entry.unit).kcal} kcal, {computeFoodStats(food, amount, entry.unit).protein}g protein</span>
              </>
            ) : (
              <>
                <NumberField value={kcalDraft} onChange={setKcalDraft} step={10} min={0} width="w-16" label={`${entry.name} calories`} />
                <span className="text-xs text-slate-400">kcal</span>
                <NumberField value={proteinDraft} onChange={setProteinDraft} step={1} min={0} width="w-16" label={`${entry.name} protein`} />
                <span className="text-xs text-slate-400">g protein</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} aria-label="Save changes" className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-300"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} aria-label="Cancel edit" className="p-2 rounded-lg hover:bg-white/10 text-slate-400"><X size={14} /></button>
          </>
        ) : (
          <>
            <span className="text-sm font-bold text-white">{entry.kcal}</span>
            <button onClick={startEdit} aria-label={`Edit ${entry.name}`} className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-200"><Pencil size={13} /></button>
            <button onClick={onDelete} aria-label={`Delete ${entry.name}`} className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-300"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function MealSection({ meal, entries, customFoods, onUpdate, onDelete, onAddToMeal, isCustom, onDeleteMealType }) {
  const total = entries.reduce((s, e) => s + (e.kcal || 0), 0);
  const totalProtein = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const hasProtein = entries.some((e) => e.protein != null);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{meal.icon}</span>
          <span className="text-sm font-bold text-white">{meal.label}</span>
          {entries.length > 0 && (
            <span className="text-[11px] text-slate-500">
              · {total} kcal{hasProtein && <span className="text-pink-300/80"> · {round1(totalProtein)}g protein</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onAddToMeal(meal.id)} className="flex items-center gap-1 text-[11px] font-semibold text-pink-300 hover:text-pink-200">
            <Plus size={12} /> Add
          </button>
          {isCustom && (
            <button
              onClick={() => onDeleteMealType(meal.id)}
              aria-label={`Remove ${meal.label} meal`}
              title="Remove this meal"
              className="text-slate-600 hover:text-rose-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600 pl-6 pb-1">Nothing logged yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <FoodEntryRow
              key={e.id} entry={e} food={e.foodId ? getFood(e.foodId, customFoods) : null}
              onUpdate={(p) => onUpdate(e.id, p)} onDelete={() => onDelete(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomFoodForm({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Snacks");
  const [baseUnit, setBaseUnit] = useState("g");
  const [baseAmount, setBaseAmount] = useState(100);
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);

  // kcal is intentionally allowed to be 0 here (water, black coffee, diet
  // soda, spices…) — only a missing name blocks saving. NumberField already
  // guarantees kcal/protein/carbs/fat are valid non-negative numbers.
  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name, category, baseUnit, baseAmount, kcal, protein, carbs, fat });
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.03] border border-dashed border-white/15">
      <input
        autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Food name"
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
      />
      <div className="flex gap-1.5 flex-wrap">
        {FOOD_CATEGORIES.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="!px-2.5 !py-1 text-xs">{c}</Chip>)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400">Per</span>
        <NumberField value={baseAmount} onChange={setBaseAmount} step={baseUnit === "g" || baseUnit === "ml" ? 10 : 1} min={1} width="w-14" label="base amount" />
        <div className="flex gap-1 flex-wrap">
          {FOOD_UNITS.map((u) => <Chip key={u} active={baseUnit === u} onClick={() => setBaseUnit(u)} className="!px-2 !py-1 text-[11px]">{u}</Chip>)}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div><label className="text-[10px] text-slate-500 block mb-1">Calories</label><NumberField value={kcal} onChange={setKcal} step={10} min={0} width="w-full" label="calories" /></div>
        <div><label className="text-[10px] text-slate-500 block mb-1">Protein g</label><NumberField value={protein} onChange={setProtein} step={1} min={0} width="w-full" label="protein" /></div>
        <div><label className="text-[10px] text-slate-500 block mb-1">Carbs g</label><NumberField value={carbs} onChange={setCarbs} step={1} min={0} width="w-full" label="carbs" /></div>
        <div><label className="text-[10px] text-slate-500 block mb-1">Fat g</label><NumberField value={fat} onChange={setFat} step={1} min={0} width="w-full" label="fat" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <GradientButton onClick={submit} disabled={!name.trim()}><Check size={14} /> Create</GradientButton>
      </div>
    </div>
  );
}

function AddFoodModal({ open, onClose, onAdd, onAddCustomFood, customFoods, defaultMeal, initialTab, mealTypes }) {
  const meals = mealTypes || MEAL_TYPES;
  const [tab, setTab] = useState("search");
  const [meal, setMeal] = useState(defaultMeal);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [picked, setPicked] = useState(null);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState("g");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [restPicked, setRestPicked] = useState(null);
  const [restName, setRestName] = useState("");
  const [restKcal, setRestKcal] = useState(500);
  const [restProtein, setRestProtein] = useState(0);
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState(0);
  const [manualProtein, setManualProtein] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab || "search");
    setMeal(defaultMeal);
    setPicked(null); setQ(""); setCategory("All"); setShowCustomForm(false);
    setRestPicked(null); setRestName(""); setRestKcal(500); setRestProtein(0);
    setManualName(""); setManualKcal(0); setManualProtein(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMeal, initialTab]);

  if (!open) return null;

  const hasCustom = Object.values(customFoods || {}).length > 0;
  const filtered = allFoods(customFoods).filter((f) => {
    const matchesCat = category === "All" ? true : category === "Custom" ? !!f.custom : f.category === category;
    return matchesCat && f.name.toLowerCase().includes(q.toLowerCase());
  });
  const mealLabel = meals.find((m) => m.id === meal)?.label;

  const pick = (f) => { setPicked(f); setUnit(f.baseUnit); setAmount(f.baseAmount); };
  const preview = picked ? computeFoodStats(picked, amount, unit) : null;

  const submitDatabase = () => {
    if (!picked) return;
    const stats = computeFoodStats(picked, amount, unit);
    onAdd({ meal, source: "database", foodId: picked.id, name: picked.name, amount, unit, ...stats });
    setPicked(null);
  };
  // restKcal/manualKcal of 0 is valid (e.g. black coffee, diet soda, water) —
  // only a missing name blocks submission. Protein is optional on both tabs:
  // a value left at 0 (the default) is treated as "not specified" rather
  // than "this meal truly has 0g protein" — see newFoodEntry/FoodEntryRow.
  const submitEstimate = () => {
    const name = restPicked ? restPicked.name : restName.trim();
    if (!name) return;
    onAdd({
      meal, source: "estimate", name, amount: 1, unit: "serving",
      kcal: Math.round(Number(restKcal) || 0),
      protein: Number(restProtein) > 0 ? round1(Number(restProtein)) : null,
    });
    setRestPicked(null); setRestName(""); setRestKcal(500); setRestProtein(0);
  };
  const submitManual = () => {
    if (!manualName.trim()) return;
    onAdd({
      meal, source: "manual", name: manualName.trim(), amount: 1, unit: "serving",
      kcal: Math.round(Number(manualKcal) || 0),
      protein: Number(manualProtein) > 0 ? round1(Number(manualProtein)) : null,
    });
    setManualName(""); setManualKcal(0); setManualProtein(0);
  };
  const createCustomFood = (payload) => {
    const food = newCustomFood(payload);
    onAddCustomFood(food);
    setShowCustomForm(false);
    pick(food);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add food" size="lg">
      <div className="flex flex-col gap-1.5 mb-3">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Meal</label>
        <div className="flex gap-1.5 flex-wrap">
          {meals.map((m) => <Chip key={m.id} active={meal === m.id} onClick={() => setMeal(m.id)}>{m.icon} {m.label}</Chip>)}
        </div>
      </div>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        <Chip active={tab === "search"} onClick={() => setTab("search")}>Search</Chip>
        <Chip active={tab === "estimate"} onClick={() => setTab("estimate")}>Estimate meal</Chip>
        <Chip active={tab === "manual"} onClick={() => setTab("manual")}>Manual</Chip>
      </div>

      {tab === "search" && (
        !picked ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {["All", ...FOOD_CATEGORIES, ...(hasCustom ? ["Custom"] : [])].map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="shrink-0">{c}</Chip>
              ))}
            </div>
            {!showCustomForm ? (
              <button onClick={() => setShowCustomForm(true)} className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-white/15 text-sm text-slate-300 hover:bg-white/5 hover:border-white/25 transition-colors">
                <Plus size={15} className="text-pink-400" /> Create a custom food
              </button>
            ) : (
              <CustomFoodForm onCreate={createCustomFood} onCancel={() => setShowCustomForm(false)} />
            )}
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1 -mx-2 px-2">
              {filtered.map((f) => (
                <button key={f.id} onClick={() => pick(f)} className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-white/5 transition-colors">
                  <span className="text-xl shrink-0">{f.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">{f.name}</div>
                    <div className="text-[11px] text-slate-500">{f.kcal} kcal / {f.baseAmount} {f.baseUnit}</div>
                  </div>
                  {f.custom && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 shrink-0">Custom</span>}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No foods match.</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button onClick={() => setPicked(null)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white w-fit"><ArrowLeft size={14} /> Back to search</button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{picked.icon}</span>
              <div>
                <div className="text-white font-bold">{picked.name}</div>
                <div className="text-xs text-slate-500">{picked.kcal} kcal per {picked.baseAmount} {picked.baseUnit}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <NumberField value={amount} onChange={setAmount} step={unit === "g" || unit === "ml" ? 10 : unit === "kg" || unit === "L" ? 0.5 : 1} min={0} width="w-20" label="amount" />
              <div className="flex gap-1.5">
                {foodUnitChoices(picked).map((u) => <Chip key={u} active={unit === u} onClick={() => setUnit(u)} className="!px-3 !py-1.5 text-xs">{u}</Chip>)}
              </div>
            </div>
            <Card className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Estimated calories</span>
                <span className="text-2xl font-black text-white">≈{preview.kcal} kcal</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                <span>Protein {preview.protein}g</span>
                <span>Carbs {preview.carbs}g</span>
                <span>Fat {preview.fat}g</span>
              </div>
            </Card>
            <GradientButton size="lg" onClick={submitDatabase}><Plus size={16} /> Add to {mealLabel}</GradientButton>
          </div>
        )
      )}

      {tab === "estimate" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">Restaurant meals are hard to measure exactly — pick the closest match or type your own, then adjust the estimate.</p>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {RESTAURANT_ESTIMATES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRestPicked(r); setRestName(""); setRestKcal(Math.round((r.kcalLow + r.kcalHigh) / 2 / 10) * 10); }}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl text-left transition-colors ${restPicked?.id === r.id ? `${GRAD} text-white` : "hover:bg-white/5 text-slate-200"}`}
              >
                <span className="text-sm font-medium min-w-0 truncate">{r.name}</span>
                <span className="text-xs opacity-80 shrink-0">{r.kcalLow}–{r.kcalHigh} kcal</span>
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Or type your own</label>
            <input
              value={restName} onChange={(e) => { setRestName(e.target.value); setRestPicked(null); }} placeholder="e.g. Burger + fries"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Estimated calories</span>
            <NumberField value={restKcal} onChange={setRestKcal} step={10} min={0} width="w-20" label="estimated calories" />
            <SourceBadge source="estimate" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Estimated protein</span>
            <NumberField value={restProtein} onChange={setRestProtein} step={1} min={0} width="w-20" label="estimated protein" />
            <span className="text-xs text-slate-500">g <span className="text-slate-600">(optional)</span></span>
          </div>
          <GradientButton size="lg" onClick={submitEstimate} disabled={!(restPicked || restName.trim())}><Plus size={16} /> Add estimate to {mealLabel}</GradientButton>
          {(restPicked || restName.trim()) && !restKcal ? (
            <p className="text-[11px] text-slate-500 -mt-2">Logging as 0 kcal. Adjust above if that's not right.</p>
          ) : null}
        </div>
      )}

      {tab === "manual" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">Already know the calories? Log it directly.</p>
          <input
            value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="What did you eat?"
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Calories</span>
            <NumberField value={manualKcal} onChange={setManualKcal} step={10} min={0} width="w-20" label="calories" />
            <SourceBadge source="manual" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Protein</span>
            <NumberField value={manualProtein} onChange={setManualProtein} step={1} min={0} width="w-20" label="protein" />
            <span className="text-xs text-slate-500">g <span className="text-slate-600">(optional)</span></span>
          </div>
          <GradientButton size="lg" onClick={submitManual} disabled={!manualName.trim()}><Plus size={16} /> Add to {mealLabel}</GradientButton>
          {manualName.trim() && !manualKcal ? (
            <p className="text-[11px] text-slate-500 -mt-2">Logging as 0 kcal. Adjust above if that's not right.</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function AddWeightModal({ open, onClose, onSubmit, iso, currentKg }) {
  const [kg, setKg] = useState(currentKg);
  useEffect(() => { if (open) setKg(currentKg); }, [open, currentKg]);
  if (!open) return null;
  return (
    <Modal
      open={open} onClose={onClose} title="Log weight"
      footer={<GradientButton onClick={() => { onSubmit(kg); onClose(); }}><Check size={14} /> Save</GradientButton>}
    >
      <p className="text-xs text-slate-500 mb-4">Logging weight for {formatNiceDate(iso)}. Weight is kept as history — this corrects that date without erasing others.</p>
      <div className="flex items-center justify-center gap-3">
        <NumberField value={kg} onChange={setKg} step={0.5} min={20} width="w-24" label="weight in kilograms" />
        <span className="text-slate-300">kg</span>
      </div>
    </Modal>
  );
}

function AddActivityModal({ open, onClose, onSubmit, iso, initial }) {
  const [steps, setSteps] = useState(initial?.steps || 0);
  const [minutes, setMinutes] = useState(initial?.workoutMinutes || 0);
  useEffect(() => { if (open) { setSteps(initial?.steps || 0); setMinutes(initial?.workoutMinutes || 0); } }, [open, initial]);
  if (!open) return null;
  return (
    <Modal
      open={open} onClose={onClose} title="Log activity"
      footer={<GradientButton onClick={() => { onSubmit({ steps, workoutMinutes: minutes }); onClose(); }}><Check size={14} /> Save</GradientButton>}
    >
      <p className="text-xs text-slate-500 mb-4">For {formatNiceDate(iso)}. Whether a workout was completed still comes from your logged sets — this just adds steps and, optionally, a duration.</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Steps</label>
          <NumberField value={steps} onChange={setSteps} step={500} min={0} width="w-24" label="steps" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Workout duration (min)</label>
          <NumberField value={minutes} onChange={setMinutes} step={5} min={0} width="w-24" label="workout minutes" />
        </div>
      </div>
    </Modal>
  );
}

// Lets a member add their own meal slot beyond the fixed breakfast/lunch/
// dinner/snack four — for anyone eating 5-6x a day (pre-workout, second
// breakfast, late-night snack, whatever fits). Just a name + icon; the new
// slot then behaves exactly like the built-in ones.
function AddMealTypeModal({ open, onClose, onCreate }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(MEAL_ICON_CHOICES[0]);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setIcon(MEAL_ICON_CHOICES[0]);
  }, [open]);

  if (!open) return null;

  const canSubmit = !!label.trim();
  const submit = () => {
    if (!canSubmit) return;
    onCreate({ label, icon });
    onClose();
  };

  return (
    <Modal
      open={open} onClose={onClose} title="Add a meal"
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GradientButton onClick={submit} disabled={!canSubmit}><Check size={14} /> Add meal</GradientButton>
        </>
      }
    >
      <p className="text-xs text-slate-500 mb-4">
        Not everyone eats on the standard four-meal schedule — add a slot for pre-workout, second breakfast, late-night snack, or anything else that fits your day.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Name</label>
          <input
            autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pre-workout"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Icon</label>
          <div className="flex gap-1.5 flex-wrap">
            {MEAL_ICON_CHOICES.map((ic) => (
              <button
                key={ic} onClick={() => setIcon(ic)} aria-label={`Choose icon ${ic}`}
                className={`w-9 h-9 rounded-xl text-base flex items-center justify-center border transition-colors ${
                  icon === ic ? `${GRAD} border-transparent` : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BodySettingsCard({ me, onUpdate }) {
  const [overrideDraft, setOverrideDraft] = useState(me.calorieTargetOverride ?? "");
  // Sync the draft if the override changes from elsewhere (e.g. cleared via
  // the "Clear" button on another device) so this field never goes stale.
  useEffect(() => { setOverrideDraft(me.calorieTargetOverride ?? ""); }, [me.calorieTargetOverride]);
  const [proteinOverrideDraft, setProteinOverrideDraft] = useState(me.proteinTargetOverride ?? "");
  useEffect(() => { setProteinOverrideDraft(me.proteinTargetOverride ?? ""); }, [me.proteinTargetOverride]);
  // Unlike every other numeric input on this page, the override is a plain
  // <input type="number"> rather than a clamped NumberField, so it's the one
  // place a stray "-" or a huge/garbage value could otherwise slip through
  // and turn every calorie number on this page into NaN or nonsense. Applying
  // clamps it to a realistic human daily-calorie range instead.
  const applyOverride = () => {
    if (overrideDraft === "") { onUpdate({ calorieTargetOverride: null }); return; }
    const n = Number(overrideDraft);
    if (!Number.isFinite(n)) { setOverrideDraft(me.calorieTargetOverride ?? ""); return; }
    onUpdate({ calorieTargetOverride: clamp(Math.round(n), 800, 8000) });
  };
  // Same reasoning as applyOverride above, clamped to a realistic daily
  // protein range (grams) instead of a calorie range.
  const applyProteinOverride = () => {
    if (proteinOverrideDraft === "") { onUpdate({ proteinTargetOverride: null }); return; }
    const n = Number(proteinOverrideDraft);
    if (!Number.isFinite(n)) { setProteinOverrideDraft(me.proteinTargetOverride ?? ""); return; }
    onUpdate({ proteinTargetOverride: clamp(Math.round(n), 20, 400) });
  };
  const weight = currentWeightKg(me);
  const bmr = calcBMR({ sex: me.sex || DEFAULT_SEX, weightKg: weight, heightCm: me.heightCm ?? DEFAULT_HEIGHT_CM, age: me.age ?? DEFAULT_AGE });
  const tdee = calcTDEE(bmr, me.activityLevel || DEFAULT_ACTIVITY_LEVEL);
  const target = calorieTargetFor(me);
  const macroTargets = macroTargetsFor(me);
  const dietGoal = dietGoalInfo(me.dietGoal);

  return (
    <Card className="p-5">
      <SectionHeading eyebrow="Estimated" title="Body, calorie & protein settings" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Weight</label>
          <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-white">{weight}</span><span className="text-xs text-slate-400">kg (latest log)</span></div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Height</label>
          <div className="flex items-center gap-1.5">
            <NumberField value={me.heightCm ?? DEFAULT_HEIGHT_CM} onChange={(v) => onUpdate({ heightCm: v })} step={1} min={100} width="w-16" label="height in centimeters" />
            <span className="text-xs text-slate-400">cm</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Age</label>
          <div className="flex items-center gap-1.5">
            <NumberField value={me.age ?? DEFAULT_AGE} onChange={(v) => onUpdate({ age: v })} step={1} min={10} width="w-16" label="age in years" />
            <span className="text-xs text-slate-400">yrs</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Sex</label>
          <div className="flex gap-1.5">
            <Chip active={(me.sex || DEFAULT_SEX) === "male"} onClick={() => onUpdate({ sex: "male" })} className="!px-2.5 !py-1 text-xs">Male</Chip>
            <Chip active={(me.sex || DEFAULT_SEX) === "female"} onClick={() => onUpdate({ sex: "female" })} className="!px-2.5 !py-1 text-xs">Female</Chip>
          </div>
        </div>
      </div>
      <div className="mb-4">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Activity level</label>
        <div className="flex gap-1.5 flex-wrap">
          {ACTIVITY_LEVELS.map((a) => (
            <Chip key={a.id} active={(me.activityLevel || DEFAULT_ACTIVITY_LEVEL) === a.id} onClick={() => onUpdate({ activityLevel: a.id })} className="!px-2.5 !py-1 text-xs">
              {a.label}
            </Chip>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">{activityLevelInfo(me.activityLevel || DEFAULT_ACTIVITY_LEVEL).desc}</p>
      </div>
      <div className="mb-4">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Diet goal</label>
        <div className="flex gap-1.5 flex-wrap">
          {DIET_GOALS.map((g) => (
            <Chip key={g.id} active={(me.dietGoal || DEFAULT_DIET_GOAL) === g.id} onClick={() => onUpdate({ dietGoal: g.id })} className="!px-2.5 !py-1 text-xs">
              {g.icon} {g.label}
            </Chip>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">{dietGoal.desc}</p>
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-1.5 mb-4">
        <div className="flex items-center justify-between text-sm"><span className="text-slate-400">BMR</span><span className="text-white font-semibold">{bmr} kcal</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-slate-400">× Activity ({activityLevelInfo(me.activityLevel || DEFAULT_ACTIVITY_LEVEL).label})</span><span className="text-white font-semibold">{tdee} kcal</span></div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">{dietGoal.label} ({dietGoal.kcalPct === 0 ? "no change" : `${dietGoal.kcalPct > 0 ? "+" : ""}${Math.round(dietGoal.kcalPct * 100)}%`})</span>
          <span className="text-white font-semibold">{me.calorieTargetOverride == null ? target : Math.round(tdee * (1 + dietGoal.kcalPct))} kcal</span>
        </div>
        <div className="h-px bg-white/10 my-1" />
        <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Daily target</span><span className="text-lg font-black text-white">{target} kcal</span></div>
        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Info size={10} className="shrink-0" /> Estimated only — not a medical calculation.{me.calorieTargetOverride != null && " Manual override below is currently active and takes priority over this."}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs text-slate-400">Manual override</span>
        <input
          type="number" min="800" max="8000" value={overrideDraft} onChange={(e) => setOverrideDraft(e.target.value)} placeholder="e.g. 2000"
          className="w-24 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-pink-400/50"
        />
        <GhostButton onClick={applyOverride} className="!px-3 !py-1.5 text-xs">Apply</GhostButton>
        {me.calorieTargetOverride != null && (
          <GhostButton onClick={() => { setOverrideDraft(""); onUpdate({ calorieTargetOverride: null }); }} className="!px-3 !py-1.5 text-xs">Clear</GhostButton>
        )}
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-1.5 mb-4">
        <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Protein ({dietGoal.proteinPerKg}g × bodyweight)</span><span className="text-white font-semibold">{Math.round((Number(weight) || DEFAULT_BODYWEIGHT_KG) * dietGoal.proteinPerKg)}g</span></div>
        <div className="h-px bg-white/10 my-1" />
        <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Daily protein target</span><span className="text-lg font-black text-white">{macroTargets.proteinG}g</span></div>
        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Info size={10} className="shrink-0" /> {dietGoal.proteinPerKg}g per kg bodyweight — {me.dietGoal === "cut" ? "raised while cutting to help protect muscle" : "a common strength/physique guideline"} — not a medical calculation.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs text-slate-400">Manual override</span>
        <input
          type="number" min="20" max="400" value={proteinOverrideDraft} onChange={(e) => setProteinOverrideDraft(e.target.value)} placeholder="e.g. 150"
          className="w-24 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-pink-400/50"
        />
        <span className="text-xs text-slate-500">g</span>
        <GhostButton onClick={applyProteinOverride} className="!px-3 !py-1.5 text-xs">Apply</GhostButton>
        {me.proteinTargetOverride != null && (
          <GhostButton onClick={() => { setProteinOverrideDraft(""); onUpdate({ proteinTargetOverride: null }); }} className="!px-3 !py-1.5 text-xs">Clear</GhostButton>
        )}
      </div>

      {/* Carbs and fat targets are always derived (25% of calories for fat,
          whatever's left for carbs — see macroTargetsFor) rather than
          independently overridable, since either one moving on its own would
          break that "remainder" relationship. Shown read-only so the same
          calorie/protein math that drives the two numbers above is visible
          for these too, not just quietly used behind the scenes. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Fat (25% of calorie target)</span><span className="text-white font-semibold">{Math.round(target * 0.25)} kcal</span></div>
          <div className="h-px bg-white/10 my-1" />
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Daily fat target</span><span className="text-lg font-black text-white">{macroTargets.fatG}g</span></div>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Info size={10} className="shrink-0" /> Fixed at 25% of calories, then converted at 9 kcal/g — not independently adjustable.</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Carbs (remaining calories)</span><span className="text-white font-semibold">{Math.max(0, target - macroTargets.proteinG * 4 - Math.round(target * 0.25))} kcal</span></div>
          <div className="h-px bg-white/10 my-1" />
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Daily carbs target</span><span className="text-lg font-black text-white">{macroTargets.carbsG}g</span></div>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Info size={10} className="shrink-0" /> Whatever's left after protein + fat, converted at 4 kcal/g. Adjusting calories or protein above moves this.</p>
        </div>
      </div>
    </Card>
  );
}

// Same visual language as ExerciseChart — a shared gradId per instance so
// multiple charts can be mounted on the same page without SVG id collisions.
function DietAreaChart({ data, dataKey, color = "#d16d94", gradId }) {
  if (data.length < 2) {
    return <div className="h-40 flex items-center justify-center text-sm text-slate-500">Not enough data yet to chart this.</div>;
  }
  // Hide per-point dots once the line gets crowded (e.g. the 30-day "Month"
  // view) — was previously gated on data.length > 30, which never fires
  // since month view tops out at exactly 30 points.
  const dense = data.length > 14;
  // Cap the number of x-axis date labels shown to ~6 no matter the range, so
  // "Month" doesn't render all 30 "Jul 11", "Jul 12", ... labels crushed on
  // top of each other (illegible, and especially bad on a narrow mobile
  // screen). Recharts' `interval` is "ticks to skip between shown ticks", so
  // interval = ceil(length / maxTicks) - 1 spaces ~maxTicks labels evenly.
  const maxTicks = 6;
  const tickInterval = data.length > 10 ? Math.ceil(data.length / maxTicks) - 1 : 0;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={tickInterval} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={dense ? false : { r: 3, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
// Same CSS-bar look as the existing MiniBarChart (workout volume), generalized
// for any numeric series — hides per-bar labels once there are too many (month view).
function DietBarChart({ data, valueKey, labelKey }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  // Same idea as DietAreaChart's tick thinning: show at most ~6 date labels
  // instead of either cramming in all 30 (crumpled) or hiding every label
  // once past 14 bars (which left month view with no dates at all).
  const maxLabels = 6;
  const labelEvery = data.length > 10 ? Math.ceil(data.length / maxLabels) : 1;
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 min-w-[4px] flex flex-col items-center gap-1.5">
          <div className="w-full rounded-t-lg bg-white/5 relative overflow-hidden" style={{ height: 64 }}>
            <div className={`absolute bottom-0 left-0 right-0 rounded-t-lg ${GRAD}`} style={{ height: `${(d[valueKey] / max) * 100}%`, transition: "height .8s cubic-bezier(.34,1.56,.64,1)" }} />
          </div>
          <span className="text-[9px] text-slate-500 h-3 leading-3">{i % labelEvery === 0 ? d[labelKey] : ""}</span>
        </div>
      ))}
    </div>
  );
}

function DietHistorySection({ me }) {
  const macroTargets = macroTargetsFor(me);
  const [range, setRange] = useState("week");
  const days = range === "week" ? 7 : 30;
  const endISO = todayISO();
  const startISO = addDaysISO(endISO, -(days - 1));
  const stats = useMemo(() => dietStatsForRange(me, startISO, endISO), [me, startISO, endISO]);

  const kcalData = stats.dates.map((d, i) => ({ label: formatShortDate(d), kcal: stats.kcalPerDay[i] }));
  const proteinData = stats.dates.map((d, i) => ({ label: formatShortDate(d), protein: stats.proteinPerDay[i] }));
  const stepsData = stats.dates.map((d, i) => ({ label: formatShortDate(d), steps: stats.stepsPerDay[i] }));
  const minutesData = stats.dates.map((d, i) => ({ label: formatShortDate(d), minutes: stats.minutesPerDay[i] }));
  const weightData = (me.weightHistory || [])
    .filter((w) => w.date >= startISO && w.date <= endISO)
    .map((w) => ({ label: formatShortDate(w.date), kg: w.kg }));

  return (
    <Card className="p-5">
      <SectionHeading
        eyebrow="History" title="Trends & analytics"
        right={
          <div className="flex gap-2">
            <Chip active={range === "week"} onClick={() => setRange("week")}>Week</Chip>
            <Chip active={range === "month"} onClick={() => setRange("month")}>Month</Chip>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <StatBlock icon={<Flame size={16} className="text-orange-400" />} label={`Avg calories (${stats.daysWithFood}/${stats.totalDays}d logged)`} value={`${stats.avgKcal}`} />
        <StatBlock icon={<Zap size={16} className="text-pink-400" />} label={`Avg protein (${stats.daysWithProtein}/${stats.totalDays}d logged)`} value={`${stats.avgMacros.protein}g`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
        <StatBlock icon={<Footprints size={16} className="text-sky-400" />} label={`Avg steps (${stats.daysWithSteps}/${stats.totalDays}d logged)`} value={stats.avgSteps.toLocaleString()} />
        <StatBlock icon={<Dumbbell size={16} className="text-amber-400" />} label={`Avg workout (${stats.daysWithMinutes}/${stats.totalDays}d logged)`} value={`${stats.avgMinutes} min`} />
        <StatBlock
          icon={<Scale size={16} className="text-fuchsia-400" />} label="Weight change"
          value={`${stats.weightChange > 0 ? "+" : ""}${stats.weightChange}kg`}
          accent={stats.weightChange < 0 ? "text-emerald-300" : stats.weightChange > 0 ? "text-amber-300" : "text-white"}
        />
      </div>
      {stats.daysWithFood > 0 && (
        <div className="flex gap-4 flex-wrap mb-6">
          <MacroBar label="Avg protein" grams={stats.avgMacros.protein} targetGrams={macroTargets.proteinG} color="#f472b6" />
          <MacroBar label="Avg carbs" grams={stats.avgMacros.carbs} targetGrams={macroTargets.carbsG} color="#38bdf8" />
          <MacroBar label="Avg fat" grams={stats.avgMacros.fat} targetGrams={macroTargets.fatG} color="#fbbf24" />
        </div>
      )}
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Calorie intake</p>
          <DietAreaChart data={kcalData} dataKey="kcal" color="#d16d94" gradId="dietKcalFill" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Protein intake</p>
          <DietAreaChart data={proteinData} dataKey="protein" color="#f472b6" gradId="dietProteinFill" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Weight trend</p>
          {weightData.length >= 2
            ? <DietAreaChart data={weightData} dataKey="kg" color="#a78bfa" gradId="dietWeightFill" />
            : <div className="h-40 flex items-center justify-center text-sm text-slate-500">Log weight on a couple more days to see a trend.</div>}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Steps</p>
          <DietBarChart data={stepsData} valueKey="steps" labelKey="label" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Workout duration</p>
          <DietBarChart data={minutesData} valueKey="minutes" labelKey="label" />
        </div>
      </div>
    </Card>
  );
}

function DietPage({ me, customFoods, onAddFood, onUpdateFood, onDeleteFood, onAddCustomFood, onLogWeight, onUpdateActivity, onUpdateBodySettings, onAddMealType, onDeleteMealType }) {
  const [iso, setIso] = useState(todayISO());
  const [foodModal, setFoodModal] = useState(null); // { defaultMeal, initialTab } | null
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);

  const entries = foodEntriesForDay(me, iso);
  const target = calorieTargetFor(me);
  const activity = activityForDay(me, iso);
  const entriesByMeal = (mealId) => entries.filter((e) => e.meal === mealId);
  // Fixed four + whatever custom slots this member has added (someone eating
  // 5-6x a day isn't stuck with just breakfast/lunch/dinner/snack).
  const mealTypes = useMemo(() => mealTypesFor(me), [me.customMealTypes]);
  const fixedMealIds = useMemo(() => new Set(MEAL_TYPES.map((m) => m.id)), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className={`text-xs font-semibold tracking-wider uppercase mb-1 ${GRAD_TEXT}`}>Diet</div>
        <h1 className="text-2xl md:text-3xl font-black text-white">Nutrition & activity</h1>
      </div>

      <DietDateNav iso={iso} onChange={setIso} me={me} />
      <DailySummaryCard me={me} iso={iso} entries={entries} target={target} />
      <DietQuickActions
        onAddFood={() => setFoodModal({ defaultMeal: defaultMealForNow() })}
        onEstimateMeal={() => setFoodModal({ defaultMeal: defaultMealForNow(), initialTab: "estimate" })}
        onAddWeight={() => setWeightModalOpen(true)}
        onAddActivity={() => setActivityModalOpen(true)}
      />

      <div className="flex flex-col gap-5">
        {mealTypes.map((m) => (
          <MealSection
            key={m.id} meal={m} entries={entriesByMeal(m.id)} customFoods={customFoods}
            onUpdate={(id, patch) => onUpdateFood(iso, id, patch)}
            onDelete={(id) => onDeleteFood(iso, id)}
            onAddToMeal={(mealId) => setFoodModal({ defaultMeal: mealId })}
            isCustom={!fixedMealIds.has(m.id)}
            onDeleteMealType={onDeleteMealType}
          />
        ))}
        <button
          onClick={() => setAddMealOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-white/15 text-sm text-slate-400 hover:bg-white/5 hover:border-white/25 hover:text-slate-300 transition-colors"
        >
          <Plus size={15} className="text-pink-400" /> Add a meal
        </button>
      </div>

      <BodySettingsCard me={me} onUpdate={onUpdateBodySettings} />
      <DietHistorySection me={me} />

      <AddFoodModal
        open={!!foodModal} onClose={() => setFoodModal(null)}
        onAdd={(payload) => onAddFood(iso, payload)}
        onAddCustomFood={onAddCustomFood}
        customFoods={customFoods}
        mealTypes={mealTypes}
        defaultMeal={foodModal?.defaultMeal || defaultMealForNow()}
        initialTab={foodModal?.initialTab}
      />
      <AddWeightModal open={weightModalOpen} onClose={() => setWeightModalOpen(false)} onSubmit={(kg) => onLogWeight(iso, kg)} iso={iso} currentKg={weightOnDate(me, iso)} />
      <AddActivityModal open={activityModalOpen} onClose={() => setActivityModalOpen(false)} onSubmit={(patch) => onUpdateActivity(iso, patch)} iso={iso} initial={activity} />
      <AddMealTypeModal open={addMealOpen} onClose={() => setAddMealOpen(false)} onCreate={onAddMealType} />
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(undefined); // undefined = not checked yet, null = signed out
  const [page, setPage] = useState("dashboard");
  const [exerciseId, setExerciseId] = useState(null);
  const [memberProfileId, setMemberProfileId] = useState(null);
  const [dayDetailISO, setDayDetailISO] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Wait until Supabase has told us whether there's a valid auth session
  // before doing the first read: reading while `authUser` is still
  // `undefined` is exactly the race that used to cause RLS to reject the
  // query (e.g. on a wrong/not-yet-settled login) and get misread as "no
  // data exists yet". `loadAttempt` lets a failed read retry itself without
  // ever treating "failed" the same as "genuinely empty".
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (authUser === undefined) return;
    let cancelled = false;
    (async () => {
      const { data: s, failed } = await storageLoadState();
      if (cancelled) return;
      if (failed) {
        // Read failed — could be a transient network/auth hiccup. Do NOT
        // treat this as "first run": that would create and save an empty
        // state over the real shared row. Just stay on the loading screen
        // and retry shortly.
        setTimeout(() => { if (!cancelled) setLoadAttempt((n) => n + 1); }, 1500);
        return;
      }
      if (s) {
        const healed = healMemberStreaks(s);
        setState(healed);
        if (healed !== s) storageSaveState(healed); // persist the correction, not just show it locally
      } else {
        // Query genuinely succeeded and found no row — this really is the
        // first run ever, so it's safe to seed it.
        const fresh = emptyAppState();
        await storageSaveState(fresh);
        if (!cancelled) setState(fresh);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authUser, loadAttempt]);

  // Google OAuth session, via Supabase Auth. `authUser` tracks Supabase's own
  // notion of who's signed in; `session.userId` (below) is the app-level id
  // used everywhere else and is only set once that auth user has a member record.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setAuthUser(sess?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once we know both who's authenticated and the current shared state, make
  // sure that auth user has a member record — creating one on first login —
  // then point `session` at it. Mirrors the old handleSubmitName bootstrap,
  // but keyed off the real Supabase auth user id instead of a typed name.
  useEffect(() => {
    if (!authUser || !state) {
      if (authUser === null) setSession(null);
      return;
    }
    const isAdminEmail = authUser.email && ADMIN_EMAILS.includes(authUser.email);
    const existing = state.members[authUser.id];
    if (existing) {
      // Upgrade an existing member to admin/approved if their email is on
      // the admin list but their record predates that (e.g. they signed in
      // before the email was added, or as a non-first member).
      if (isAdminEmail && (existing.role !== "admin" || existing.status !== "approved")) {
        const upgraded = { ...existing, role: "admin", status: "approved" };
        const next = { ...state, members: { ...state.members, [authUser.id]: upgraded } };
        lastPersistRef.current = Date.now();
        setState(next);
        storageSaveState(next);
      }
      setSession({ userId: authUser.id });
      return;
    }
    const isFirst = Object.keys(state.members).length === 0;
    const displayName =
      authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || "New Member";
    const m = newMember({
      id: authUser.id,
      name: displayName,
      avatarUrl: authUser.user_metadata?.avatar_url || null,
      role: (isFirst || isAdminEmail) ? "admin" : "member",
      status: (isFirst || isAdminEmail) ? "approved" : "pending",
    });
    const next = { ...state, members: { ...state.members, [m.id]: m } };
    lastPersistRef.current = Date.now();
    setState(next);
    storageSaveState(next);
    setSession({ userId: m.id });
  }, [authUser, state?.members]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message, icon = "✨") => setToast({ message, icon }), []);

  // Keep the (module-level) merged exercise-lookup index in sync with shared state,
  // so getEx() resolves custom exercises everywhere without prop-drilling it into
  // every component that renders an exercise name/icon/instructions.
  useEffect(() => {
    syncExerciseIndex(state?.customExercises || {});
  }, [state?.customExercises]);

  const lastPersistRef = useRef(0);
  const persist = useCallback((next) => {
    lastPersistRef.current = Date.now();
    setState(next);
    storageSaveState(next);
  }, []);

  const fetchFreshState = useCallback(async () => {
    if (Date.now() - lastPersistRef.current < 3000) return; // don't clobber a very recent local write
    const { data: fresh, failed } = await storageLoadState();
    if (!failed && fresh) setState(healMemberStreaks(fresh));
  }, []);

  const handleRefreshState = useCallback(async () => {
    setRefreshing(true);
    lastPersistRef.current = 0; // manual refresh should always go through
    const { data: fresh, failed } = await storageLoadState();
    if (!failed && fresh) setState(healMemberStreaks(fresh));
    setRefreshing(false);
  }, []);

  // Keep shared data in sync across sessions: fast polling while waiting on approval,
  // slower background polling once approved (so e.g. new join requests or a friend's
  // freshly-created program show up without a full page reload).
  const myStatus = state?.members?.[session?.userId]?.status;
  useEffect(() => {
    if (!session?.userId || !myStatus) return;
    const intervalMs = myStatus === "pending" ? 6000 : 20000;
    const t = setInterval(fetchFreshState, intervalMs);
    return () => clearInterval(t);
  }, [session?.userId, myStatus, fetchFreshState]);

  useEffect(() => {
    if (session && state?.members?.[session.userId]) {
      storageLoadPhotos(session.userId).then(setPhotos);
    } else {
      setPhotos([]);
    }
  }, [session?.userId, !!state?.members?.[session?.userId]]);

  const handleGoTo = useCallback((id) => {
    setPage(id);
    setExerciseId(null);
    setMemberProfileId(null);
    setDayDetailISO(null);
    setDrawerOpen(false);
  }, []);

  // Calendar dates jump straight to the live Today page if it's today, otherwise
  // they open a read-only summary of that day's plan/logged workout.
  const handleSelectDate = useCallback((iso) => {
    if (iso === todayISO()) {
      handleGoTo("today");
    } else {
      setExerciseId(null);
      setMemberProfileId(null);
      setDayDetailISO(iso);
    }
  }, [handleGoTo]);

  const handleGoogleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPage("dashboard");
    setExerciseId(null);
    setMemberProfileId(null);
    setDayDetailISO(null);
    setPhotos([]);
  };

  const handleApprove = (id) => persist({ ...state, members: { ...state.members, [id]: { ...state.members[id], status: "approved" } } });
  const handleReject = (id) => { const members = { ...state.members }; delete members[id]; persist({ ...state, members }); };
  const handleRemoveMember = (id) => {
    const members = { ...state.members }; delete members[id];
    const programs = { ...state.programs };
    Object.values(programs).forEach((p) => { if (p.ownerId === id) delete programs[p.id]; });
    persist({ ...state, members, programs });
    setMemberProfileId(null);
    showToast("Member removed", "🗑️");
  };

  const handleSaveProgram = (draft) => {
    const programs = { ...state.programs };
    if (draft.active) {
      Object.values(programs).forEach((p) => { if (p.ownerId === draft.ownerId && p.id !== draft.id) programs[p.id] = { ...p, active: false }; });
    }
    programs[draft.id] = draft;
    let members = state.members;
    if (draft.active) members = { ...members, [draft.ownerId]: { ...members[draft.ownerId], activeProgramId: draft.id } };
    persist({ ...state, programs, members });
    showToast("Program saved", "💾");
  };
  const handleActivateProgram = (id) => {
    const programs = { ...state.programs };
    const target = programs[id];
    Object.values(programs).forEach((p) => { if (p.ownerId === target.ownerId) programs[p.id] = { ...p, active: p.id === id }; });
    const members = { ...state.members, [target.ownerId]: { ...state.members[target.ownerId], activeProgramId: id } };
    persist({ ...state, programs, members });
    showToast("Program activated", "⚡");
  };
  const handleDuplicateProgram = (id) => {
    const src = state.programs[id];
    const clone = { ...src, id: uid("prog"), name: src.name + " (Copy)", active: false, days: JSON.parse(JSON.stringify(src.days)) };
    persist({ ...state, programs: { ...state.programs, [clone.id]: clone } });
  };
  const handleDeleteProgram = (id) => {
    const programs = { ...state.programs };
    const wasActive = programs[id]?.active;
    const ownerId = programs[id]?.ownerId;
    delete programs[id];
    let members = state.members;
    if (wasActive) members = { ...members, [ownerId]: { ...members[ownerId], activeProgramId: null } };
    persist({ ...state, programs, members });
  };

  // Copy another member's program into my own program list. The day/exercise
  // structure is cloned as-is, but for any exercise I already have somewhere in
  // one of my own programs, my own sets/reps/target weight are kept instead of
  // theirs — so copying a crew-mate's program doesn't overwrite numbers I've
  // already dialed in for exercises we share.
  const handleCopyProgramFromMember = (programId) => {
    const src = state.programs[programId];
    const meMember = state.members[session.userId];
    if (!src || !meMember) return;

    const myExerciseData = {};
    Object.values(state.programs)
      .filter((p) => p.ownerId === meMember.id)
      .forEach((p) => {
        DAY_ORDER.forEach((d) => {
          const sched = p.days?.[d];
          if (sched?.type !== "workout") return;
          (sched.exercises || []).forEach((pex) => {
            if (!myExerciseData[pex.exerciseId]) {
              myExerciseData[pex.exerciseId] = { sets: pex.sets, reps: pex.reps, targetWeight: pex.targetWeight, targetAddedWeight: pex.targetAddedWeight };
            }
          });
        });
      });

    const days = {};
    DAY_ORDER.forEach((d) => {
      const sched = src.days?.[d];
      if (sched?.type === "workout") {
        days[d] = {
          type: "workout",
          exercises: (sched.exercises || []).map((pex) => {
            const mine = myExerciseData[pex.exerciseId];
            return mine ? { ...pex, sets: mine.sets, reps: mine.reps, targetWeight: mine.targetWeight, targetAddedWeight: mine.targetAddedWeight } : { ...pex };
          }),
        };
      } else {
        days[d] = { type: "rest", exercises: [] };
      }
    });

    const sourceMember = state.members[src.ownerId];
    const clone = {
      id: uid("prog"),
      ownerId: meMember.id,
      name: sourceMember ? `${src.name} (from ${sourceMember.name})` : `${src.name} (Copy)`,
      description: src.description,
      active: false,
      days,
    };
    persist({ ...state, programs: { ...state.programs, [clone.id]: clone } });
    showToast("Program copied — your existing numbers were kept", "📋");
  };

  const handleAddCustomExercise = (payload) => {
    const ex = newCustomExercise({ ...payload, createdBy: session.userId });
    persist({ ...state, customExercises: { ...state.customExercises, [ex.id]: ex } });
    showToast(`"${ex.name}" added to your library`, "🆕");
    return ex.id;
  };
  // Editing keeps the same id, so every program day, history entry, and worklog that
  // references this exercise (all of which store only the id, never a copy of the
  // name/muscle/icon/etc.) picks up the change immediately via getEx() — no separate
  // sync step needed anywhere else in the app.
  const handleEditCustomExercise = ({ id, ...payload }) => {
    const existing = state.customExercises[id];
    if (!existing) return;
    const updated = {
      ...existing,
      name: payload.name.trim(),
      muscle: payload.muscle || existing.muscle,
      secondary: Array.isArray(payload.secondary) ? payload.secondary : [],
      icon: payload.icon || existing.icon,
      loadType: payload.loadType || existing.loadType,
      bwPercent: payload.loadType === "bodyweight" ? (Number(payload.bwPercent) || 100) : undefined,
      instructions: (payload.instructions || "").trim() || existing.instructions,
    };
    persist({ ...state, customExercises: { ...state.customExercises, [id]: updated } });
    showToast(`"${updated.name}" updated everywhere it's used`, "✏️");
  };
  const handleDeleteCustomExercise = (id) => {
    const ex = state.customExercises[id];
    if (!ex) return;
    const me = state.members[session.userId];
    // Exercises created before this field existed have no recorded owner —
    // treat those as unowned/legacy rather than locking everyone out of them.
    const isOwner = !ex.createdBy || ex.createdBy === session.userId;
    if (!isOwner && me?.role !== "admin") {
      showToast("Only its creator or an admin can delete this exercise", "🔒");
      return;
    }
    const inProgram = Object.values(state.programs).some((p) =>
      DAY_ORDER.some((d) => (p.days?.[d]?.exercises || []).some((e) => e.exerciseId === id))
    );
    const inHistory = Object.values(state.members).some((mm) => (mm.history?.[id] || []).length > 0);
    if (inProgram || inHistory) {
      showToast("This exercise is used in a program or logged history — can't delete it", "⚠️");
      return;
    }
    const customExercises = { ...state.customExercises };
    delete customExercises[id];
    persist({ ...state, customExercises });
    showToast("Custom exercise deleted", "🗑️");
  };

  const handleCompleteExercise = (finalizedInst, allInstances) => {
    const m = state.members[session.userId];
    const before = m.unlocked || [];
    const program = m.activeProgramId ? state.programs[m.activeProgramId] : null;
    const { next, xpGain, allDone } = completeExerciseOnMember(m, finalizedInst, allInstances, program);
    const programs = syncAllOwnedProgramsToLatestLog(state.programs, m.id, finalizedInst.exerciseId, next.history[finalizedInst.exerciseId]);
    persist({ ...state, members: { ...state.members, [session.userId]: next }, programs });
    if (allDone && finalizedInst.isPR) showToast(`Workout complete + new PR! +${xpGain} XP`, "🏆");
    else if (finalizedInst.isPR) showToast(`New personal record! +${xpGain} XP`, "🏆");
    else if (allDone) showToast(`Workout complete! +${xpGain} XP`, "🎉");
    else showToast(`+${xpGain} XP`, "⚡");
    const newly = next.unlocked.filter((id) => !before.includes(id));
    newly.forEach((id, i) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) setTimeout(() => showToast(`${a.name} unlocked!`, a.icon), 1700 + i * 1800);
    });
  };

  const handleEditDone = (oldInst, updatedInst) => {
    const m = state.members[session.userId];
    const before = m.unlocked || [];
    const iso = todayISO();
    const exerciseId = oldInst.exerciseId;
    const hist = [...(m.history[exerciseId] || [])];
    const idx = hist.length - 1;
    const oldVol = hist[idx]?.volume || 0;
    const newVol = volumeOf(updatedInst.sets, updatedInst.reps, updatedInst.weight);

    // Recompute whether this session is a PR against every *other* session for
    // this exercise (i.e. excluding the entry being edited) rather than trusting
    // whatever isPR was decided at the original completion time.
    const priorMax = hist.reduce((max, h, i) => (i === idx ? max : Math.max(max, h.weight)), 0);
    const newIsPR = updatedInst.weight > priorMax;
    const oldIsPR = !!m.worklogs[iso]?.exercises?.[exerciseId]?.isPR;
    const prDelta = (newIsPR ? 1 : 0) - (oldIsPR ? 1 : 0);

    if (idx >= 0) hist[idx] = { ...hist[idx], sets: updatedInst.sets, reps: updatedInst.reps, weight: updatedInst.weight, addedWeight: updatedInst.addedWeight, volume: newVol };
    const wl = m.worklogs[iso] || { exercises: {} };
    const exercises = { ...wl.exercises, [exerciseId]: { ...wl.exercises[exerciseId], sets: updatedInst.sets, reps: updatedInst.reps, weight: updatedInst.weight, addedWeight: updatedInst.addedWeight, isPR: newIsPR } };

    let next = {
      ...m,
      history: { ...m.history, [exerciseId]: hist },
      worklogs: { ...m.worklogs, [iso]: { ...wl, exercises } },
      totalVolume: (m.totalVolume || 0) - oldVol + newVol,
      prCount: Math.max(0, (m.prCount || 0) + prDelta),
      xp: Math.max(0, (m.xp || 0) + prDelta * 10),
    };
    next.level = levelInfo(next.xp).level;
    next.unlocked = recomputeAchievements(next);

    const programs = syncAllOwnedProgramsToLatestLog(state.programs, m.id, exerciseId, next.history[exerciseId]);

    persist({ ...state, members: { ...state.members, [session.userId]: next }, programs });

    if (prDelta > 0) showToast("New personal record! +10 XP", "🏆");
    else if (prDelta < 0) showToast("Edit saved — no longer a PR", "✏️");

    const newly = next.unlocked.filter((id) => !before.includes(id));
    newly.forEach((id, i) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) setTimeout(() => showToast(`${a.name} unlocked!`, a.icon), 1700 + i * 1800);
    });
  };

  // Log or edit an exercise's numbers for any date from the calendar's Day
  // Detail page — past sessions included. Streaks are recomputed from the
  // full worklog history (see recomputeStreak/applyStreak), so backfilling a
  // forgotten session here correctly restores/extends the streak, exactly as
  // if it had been logged on the day itself. Program targets are still
  // synced to whatever is now the latest log for this exercise — an edit
  // here can be the most recent entry for an exercise just as easily as one
  // made on the Today page, and the Program tab should reflect that.
  const handleEditWorklogForDate = (iso, exerciseId, patch) => {
    const m = state.members[session.userId];
    const before = m.unlocked || [];
    const program = m.activeProgramId ? state.programs[m.activeProgramId] : null;
    const sched = program?.days?.[dayKeyForISO(iso)];
    const { next, newIsPR, workoutsDelta } = upsertWorklogEntryForDate(m, iso, exerciseId, patch, sched, program);
    const programs = syncAllOwnedProgramsToLatestLog(state.programs, m.id, exerciseId, next.history[exerciseId]);
    persist({ ...state, members: { ...state.members, [session.userId]: next }, programs });
    if (newIsPR) showToast("New personal record!", "🏆");
    else if (workoutsDelta > 0) showToast("Session marked complete", "🎉");
    else showToast("Log saved", "✏️");
    const newly = next.unlocked.filter((id) => !before.includes(id));
    newly.forEach((id, i) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) setTimeout(() => showToast(`${a.name} unlocked!`, a.icon), 1700 + i * 1800);
    });
  };

  // Revert a logged exercise on any date back to "not logged". If that
  // entry was the latest log for this exercise, the program re-syncs to
  // whatever is now the latest remaining entry (or is left untouched if no
  // history remains at all).
  const handleClearWorklogForDate = (iso, exerciseId) => {
    const m = state.members[session.userId];
    const program = m.activeProgramId ? state.programs[m.activeProgramId] : null;
    const { next, changed } = clearWorklogEntryForDate(m, iso, exerciseId, program);
    if (!changed) return;
    const programs = syncAllOwnedProgramsToLatestLog(state.programs, m.id, exerciseId, next.history[exerciseId]);
    persist({ ...state, members: { ...state.members, [session.userId]: next }, programs });
    showToast("Log cleared", "🗑️");
  };

  const handleSaveNote = (exerciseId_, text) => {
    const m = state.members[session.userId];
    const next = { ...m, exerciseNotes: { ...m.exerciseNotes, [exerciseId_]: text } };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
  };
  const handleSaveCustomInstructions = (exerciseId_, text) => {
    const existing = state.customExercises[exerciseId_];
    if (!existing) return;
    const trimmed = text.trim() || "Custom exercise — added by you. Tap into it any time to add form notes.";
    persist({ ...state, customExercises: { ...state.customExercises, [exerciseId_]: { ...existing, instructions: trimmed } } });
  };

  const handleUpdateProfile = (patch) => {
    const m = state.members[session.userId];
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      const collision = Object.values(state.members).some(
        (other) => other.id !== m.id && other.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (collision) {
        showToast("That name is already taken by another member", "🚫");
        return;
      }
      patch = { ...patch, name: trimmed };
    }
    // Bodyweight can be edited here (Profile) or from the Diet tab's quick "Add
    // weight" action — both paths funnel through this same handler, so there is
    // only ever one weight history to keep in sync (spec §5/§20).
    if (patch.bodyweightKg !== undefined) {
      patch = { ...patch, weightHistory: upsertWeightEntry(m.weightHistory, todayISO(), patch.bodyweightKg) };
    }
    const next = { ...m, ...patch };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
  };

  // ---- Diet: weight logged for a specific date (not necessarily today) ----
  const handleLogWeight = (iso, kg) => {
    const m = state.members[session.userId];
    const weightHistory = upsertWeightEntry(m.weightHistory, iso, kg);
    // Only overwrite the "current" bodyweightKg mirror if this log is (now) the
    // most recent entry — logging a correction for a past date shouldn't move
    // "current weight" backwards.
    const isLatest = weightHistory[weightHistory.length - 1].date === iso;
    const next = { ...m, weightHistory, ...(isLatest ? { bodyweightKg: Math.round(Number(kg) * 10) / 10 } : {}) };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
    showToast("Weight logged", "⚖️");
  };

  // ---- Diet: food log CRUD — every entry belongs to a date+meal, and every
  // total downstream (daily/weekly/monthly/charts) is derived live from this
  // same array, never duplicated (spec §14/§20) ----
  const handleAddFoodEntry = (iso, entryPayload) => {
    const m = state.members[session.userId];
    const entry = newFoodEntry(entryPayload);
    const dayList = [...(m.foodLog?.[iso] || []), entry];
    const next = { ...m, foodLog: { ...m.foodLog, [iso]: dayList } };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
    showToast(`${entry.name || "Food"} added`, "🍽️");
  };
  const handleUpdateFoodEntry = (iso, entryId, patch) => {
    const m = state.members[session.userId];
    const dayList = (m.foodLog?.[iso] || []).map((e) => (e.id === entryId ? { ...e, ...patch } : e));
    const next = { ...m, foodLog: { ...m.foodLog, [iso]: dayList } };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
  };
  const handleDeleteFoodEntry = (iso, entryId) => {
    const m = state.members[session.userId];
    const dayList = (m.foodLog?.[iso] || []).filter((e) => e.id !== entryId);
    const next = { ...m, foodLog: { ...m.foodLog, [iso]: dayList } };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
  };

  // ---- Diet: custom foods are shared crew-wide, exactly like custom exercises.
  // The caller builds the full food object (via newCustomFood()) so the id it
  // uses for an immediate local preview is the exact same id that gets persisted. ----
  const handleAddCustomFood = (food) => {
    persist({ ...state, customFoods: { ...state.customFoods, [food.id]: food } });
    showToast(`"${food.name}" added to the food database`, "🆕");
    return food.id;
  };

  // ---- Diet: custom meal slots are per-member (unlike customFoods, which are
  // crew-wide) since everyone's meal structure differs — one person's 6-meal
  // bodybuilding split isn't another's. Deleting one is blocked if it still has
  // logged entries anywhere in that member's history, so a food entry can never
  // end up pointing at a meal slot that no longer exists. ----
  const handleAddMealType = (payload) => {
    const m = state.members[session.userId];
    const mealType = newMealType(payload);
    const next = { ...m, customMealTypes: [...(m.customMealTypes || []), mealType] };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
    showToast(`"${mealType.label}" added`, "🆕");
  };
  const handleDeleteMealType = (id) => {
    const m = state.members[session.userId];
    const inUse = Object.values(m.foodLog || {}).some((dayList) => dayList.some((e) => e.meal === id));
    if (inUse) {
      showToast("This meal has logged entries — clear them first", "⚠️");
      return;
    }
    const next = { ...m, customMealTypes: (m.customMealTypes || []).filter((mt) => mt.id !== id) };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
    showToast("Meal removed", "🗑️");
  };

  // ---- Diet: steps / logged workout minutes for a date. Workout *completion*
  // itself always comes from the existing worklogs — this only stores the two
  // extra numbers Diet needs that nothing else already tracks. ----
  const handleUpdateActivity = (iso, patch) => {
    const m = state.members[session.userId];
    const day = { ...(m.activityLog?.[iso] || { steps: 0, workoutMinutes: 0 }), ...patch };
    const next = { ...m, activityLog: { ...m.activityLog, [iso]: day } };
    persist({ ...state, members: { ...state.members, [session.userId]: next } });
  };

  const handleAddPhoto = (dataUrl, note = "", date) => {
    setPhotos((prev) => {
      const next = [...prev, { id: uid("photo"), date: date || todayISO(), dataUrl, note }];
      storageSavePhotos(session.userId, next);
      return next;
    });
    const m = state.members[session.userId];
    const withCount = { ...m, photoCount: (m.photoCount || 0) + 1 };
    const nextMember = { ...withCount, unlocked: recomputeAchievements(withCount) };
    persist({ ...state, members: { ...state.members, [session.userId]: nextMember } });
    showToast("Photo added", "📸");
  };
  const handleDeletePhoto = (id) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      storageSavePhotos(session.userId, next);
      return next;
    });
  };
  const handleUpdatePhotoNote = (id, note) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, note } : p));
      storageSavePhotos(session.userId, next);
      return next;
    });
  };
  const handleUpdatePhotoDate = (id, date) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, date } : p));
      storageSavePhotos(session.userId, next);
      return next;
    });
  };

  if (loading || !state || authUser === undefined) return <LoadingScreen />;
  if (!authUser) return <><style>{GLOBAL_STYLES}</style><LoginScreen onGoogleSignIn={handleGoogleSignIn} /></>;
  if (!session) return <LoadingScreen />; // member record is being provisioned

  const me = state.members[session.userId];
  if (!me) return <LoadingScreen />;

  let main;
  if (exerciseId) {
    main = <ExerciseDetailPage exerciseId={exerciseId} me={me} onBack={() => setExerciseId(null)} onSaveNote={handleSaveNote} onSaveInstructions={handleSaveCustomInstructions} onEditCustom={handleEditCustomExercise} canEditCustom={(e) => !e.createdBy || e.createdBy === me?.id || me?.role === "admin"} />;
  } else if (memberProfileId && state.members[memberProfileId]) {
    main = <MemberProfilePage member={state.members[memberProfileId]} me={me} programs={state.programs} onBack={() => setMemberProfileId(null)} onRemove={handleRemoveMember} onCopyProgram={handleCopyProgramFromMember} />;
  } else if (dayDetailISO) {
    main = (
      <DayDetailPage
        iso={dayDetailISO} me={me} programs={state.programs}
        onBack={() => setDayDetailISO(null)} openExercise={setExerciseId}
        goToToday={() => handleGoTo("today")}
        onEditEntry={handleEditWorklogForDate}
        onClearEntry={handleClearWorklogForDate}
      />
    );
  } else {
    switch (page) {
      case "today":
        main = <TodayPage me={me} programs={state.programs} openExercise={setExerciseId} onCompleteExercise={handleCompleteExercise} onEditDone={handleEditDone} onCreateProgram={() => handleGoTo("programs")} />;
        break;
      case "programs":
        main = <ProgramsPage me={me} programs={state.programs} onActivate={handleActivateProgram} onSaveProgram={handleSaveProgram} onDuplicate={handleDuplicateProgram} onDelete={handleDeleteProgram} customExercises={state.customExercises} onAddCustom={handleAddCustomExercise} onEditCustom={handleEditCustomExercise} onDeleteCustom={handleDeleteCustomExercise} onSaveNote={handleSaveNote} onSaveInstructions={handleSaveCustomInstructions} />;
        break;
      case "diet":
        main = (
          <DietPage
            me={me} customFoods={state.customFoods}
            onAddFood={handleAddFoodEntry} onUpdateFood={handleUpdateFoodEntry} onDeleteFood={handleDeleteFoodEntry}
            onAddCustomFood={handleAddCustomFood}
            onLogWeight={handleLogWeight} onUpdateActivity={handleUpdateActivity}
            onUpdateBodySettings={handleUpdateProfile}
            onAddMealType={handleAddMealType} onDeleteMealType={handleDeleteMealType}
          />
        );
        break;
      case "members":
        main = <MembersPage me={me} members={state.members} programs={state.programs} onOpen={setMemberProfileId} onApprove={handleApprove} onReject={handleReject} onRefresh={handleRefreshState} refreshing={refreshing} />;
        break;
      case "profile":
        main = (
          <ProfilePage
            me={me} programs={state.programs} photos={photos}
            onUpdate={handleUpdateProfile} onAddPhoto={handleAddPhoto} onDeletePhoto={handleDeletePhoto}
            onUpdatePhotoNote={handleUpdatePhotoNote} onUpdatePhotoDate={handleUpdatePhotoDate}
            onSignOut={handleSignOut} goTo={handleGoTo} onSelectDate={handleSelectDate}
          />
        );
        break;
      default:
        main = <Dashboard me={me} members={state.members} programs={state.programs} goTo={handleGoTo} onSelectDate={handleSelectDate} />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <style>{GLOBAL_STYLES}</style>
      <BackgroundGlow />
      <div className="relative flex">
        <Sidebar me={me} page={page} goTo={handleGoTo} onOpenProfile={() => handleGoTo("profile")} onSignOut={handleSignOut} />
        <div className="flex-1 min-w-0">
          <MobileTopbar me={me} onMenu={() => setDrawerOpen(true)} />
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} me={me} page={page} goTo={handleGoTo} onSignOut={handleSignOut} />
          <main className="max-w-5xl mx-auto p-5 md:p-8 pb-16">
            {me.status === "pending" && <PendingApprovalBanner onRefresh={handleRefreshState} refreshing={refreshing} />}
            <div key={page + exerciseId + memberProfileId + dayDetailISO} className="animate-[fadeIn_.25s_ease-out]">
              {main}
            </div>
          </main>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
