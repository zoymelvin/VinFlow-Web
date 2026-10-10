import type { Goal, GoalSaving } from "@/store/useFinanceStore";

/** Current month YYYY-MM */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Month from date string */
export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

/** Total savings for a goal (sum of positive savings) */
export function goalSavingsTotal(goalSavings: GoalSaving[]): number {
  return goalSavings.filter((s) => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
}

/** Remaining amount to target */
export function goalRemaining(goal: Goal, saved: number): number {
  return Math.max(0, goal.target - saved);
}

/** Projected completion date based on current savings rate */
export function projectedCompletion(goal: Goal, saved: number, savingsHistory: GoalSaving[]): string | null {
  if (saved >= goal.target) return new Date().toISOString().slice(0, 10);
  const months = savingsHistory.length;
  if (months === 0) return null;
  const monthlyRate = saved / months;
  if (!monthlyRate || monthlyRate <= 0) return null;
  const remaining = goal.target - saved;
  const monthsNeeded = Math.ceil(remaining / monthlyRate);
  const completionDate = new Date();
  completionDate.setMonth(completionDate.getMonth() + monthsNeeded);
  return completionDate.toISOString().slice(0, 10);
}

/** Current status based on deadline and completion */
export function goalStatus(goal: Goal, saved: number): "active" | "paused" | "completed" | "archived" {
  if (goal.status === "archived") return "archived";
  if (goal.status === "paused") return "paused";
  if (saved >= goal.target) return "completed";
  if (goal.deadline && new Date() > new Date(goal.deadline)) return "paused";
  return "active";
}

/** Days remaining until deadline (if any) */
export function daysUntilDeadline(deadline?: string): number {
  if (!deadline) return Infinity;
  const diff = new Date(deadline).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Suggestion for monthly contribution based on history */
export function suggestedMonthlySaving(goalId: string, savings: GoalSaving[]): number | null {
  const goalSaves = savings.filter((s) => s.goalId === goalId && s.amount > 0);
  if (goalSaves.length === 0) return null;
  const total = goalSaves.reduce((sum, s) => sum + s.amount, 0);
  return Math.round(total / goalSaves.length);
}

/** Check if a goal is at risk (saved < 30% of target) */
export function goalAtRisk(goal: Goal, saved: number): boolean {
  return saved / goal.target < 0.3;
}

/** Fetch all savings for a specific goal */
export function goalSavingsForGoal(savings: GoalSaving[], goalId: string): GoalSaving[] {
  return savings.filter((s) => s.goalId === goalId);
}

/** Latest saving transaction for goal (to update balance) */
export function latestGoalSaving(goalId: string, savings: GoalSaving[]): GoalSaving | null {
  const list = goalSavingsForGoal(savings, goalId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return list[0] || null;
}
