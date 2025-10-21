import { z } from "zod";

export const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(10).optional().nullable(),
  due_date: z.string().optional().nullable(),
  project_id: z.number().optional().nullable(),
  status: z
    .enum(["ongoing", "under review", "completed"])
    .optional()
    .nullable(),
  file: z.string().nullable().optional(),
  collaborators: z.array(z.string()).optional().nullable(),
  owner_id: z.string().optional().nullable(),
  // Recurrence fields
  is_recurring: z.boolean().optional().nullable(),
  recurrence_pattern: z
    .enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"])
    .optional()
    .nullable(),
  recurrence_interval: z.number().int().min(1).optional().nullable(),
  recurrence_end_date: z.string().optional().nullable(),
  recurrence_count: z.number().int().min(1).optional().nullable(),
  parent_recurrence_id: z.number().optional().nullable(),
  recurrence_series_id: z.string().optional().nullable(),
  next_occurrence_date: z.string().optional().nullable(),
  last_completed_date: z.string().optional().nullable(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  department: z.string().min(1),
  role: z.string().min(1),
  emp_id: z.string().min(1),
});

export const ProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  members: z.array(z.string()).optional().nullable(),
});

