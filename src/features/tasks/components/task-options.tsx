import type { SelectOption } from "@/components/ui/option-select";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES, type TaskPriority, type TaskStatus } from "../constants";
import { PriorityGlyph, StatusGlyph } from "./task-chips";

/** Options for OptionSelect, with the same glyphs the table uses so a choice looks like its result. */
export const STATUS_OPTIONS: SelectOption<TaskStatus>[] = STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
  icon: <StatusGlyph status={value} />,
}));

export const PRIORITY_OPTIONS: SelectOption<TaskPriority>[] = PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
  icon: <PriorityGlyph priority={value} />,
}));
