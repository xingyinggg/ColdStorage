import { z } from "zod";

export const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional().nullable(),
  due_date: z.string().optional().nullable(),
  project_id: z.number().optional().nullable(),
  status: z
    .enum(["under review", "ongoing", "completed", "unassigned"])
    .optional()
    .nullable(),
  file: z.string().nullable().optional(),
  collaborators: z.array(z.string()).optional().nullable(),
  owner_id: z.string().optional().nullable(),
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
