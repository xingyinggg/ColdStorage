-- Migration: add unique constraint to prevent duplicate notifications for the same task/user/type/title
-- Safe: checks for existing constraint before adding

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_notifications_task_emp_type_title'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT uniq_notifications_task_emp_type_title UNIQUE (task_id, emp_id, type, title);
  END IF;
END $$;
