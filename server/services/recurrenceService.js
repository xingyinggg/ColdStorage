/**
 * Recurrence Service - Simplified Implementation
 * 
 * Logic:
 * - Recurring tasks are just regular tasks with recurrence metadata
 * - When a task is completed (or due date reached), create a NEW task with updated due date
 * - No separate history table, no master/instance concept
 * - Each task is independent but carries recurrence information
 */

import { randomUUID } from 'crypto';

/**
 * Calculate the next occurrence of a specific weekday from a given date
 * @param {Date} fromDate - The date to start from
 * @param {number} targetWeekday - Target day of week (0 = Sunday, 6 = Saturday)
 * @param {number} weeksToAdd - Number of additional weeks to add after finding next occurrence
 * @returns {Date} - The next occurrence of the target weekday
 */
function getNextWeekday(fromDate, targetWeekday, weeksToAdd = 0) {
  const date = new Date(fromDate);
  const currentWeekday = date.getDay();
  
  console.log(`🔍 getNextWeekday: from ${date.toISOString().split('T')[0]} (day ${currentWeekday}) to day ${targetWeekday}, +${weeksToAdd} weeks`);
  
  // Calculate days until target weekday
  let daysToAdd = targetWeekday - currentWeekday;
  
  // If target day is in the past this week, move to next week
  if (daysToAdd < 0) {
    daysToAdd += 7;
  } else if (daysToAdd === 0) {
    // If it's the SAME day (e.g., completing Wed, next is also Wed)
    // We need to move to NEXT week's occurrence
    daysToAdd = 7;
  }
  // If daysToAdd > 0, it's later in the current week, so use it as-is
  
  // Add the calculated days plus any additional weeks
  date.setDate(date.getDate() + daysToAdd + (weeksToAdd * 7));
  
  console.log(`✅ getNextWeekday result: ${date.toISOString().split('T')[0]} (added ${daysToAdd} days + ${weeksToAdd * 7} week-days = ${daysToAdd + (weeksToAdd * 7)} total)`);
  
  return date;
}

/**
 * Calculate the next occurrence date based on recurrence pattern
 * @param {Date} currentDate - The current/last occurrence date
 * @param {string} pattern - The recurrence pattern (daily, weekly, monthly, etc.)
 * @param {number} interval - The interval multiplier (e.g., every 2 weeks)
 * @param {number} weekday - Target weekday for weekly patterns (0-6, Sunday-Saturday)
 * @returns {Date} - The next occurrence date
 */
export function calculateNextOccurrence(currentDate, pattern, interval = 1, weekday = null) {
  const date = new Date(currentDate);
  
  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
      
    case 'weekly':
      if (weekday !== null && weekday !== undefined) {
        // Find the NEXT occurrence of the target weekday
        // weeksToAdd = 0 means find next occurrence in current or following week
        return getNextWeekday(date, weekday, 0);
      } else {
        // Default: add weeks from current date
        date.setDate(date.getDate() + (7 * interval));
      }
      break;
      
    case 'biweekly':
      if (weekday !== null && weekday !== undefined) {
        // For biweekly, find next occurrence and add 1 week (total 2 weeks)
        return getNextWeekday(date, weekday, 1);
      } else {
        // Default: add 2 weeks from current date
        date.setDate(date.getDate() + (14 * interval));
      }
      break;
      
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
      
    case 'quarterly':
      date.setMonth(date.getMonth() + (3 * interval));
      break;
      
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
      
    default:
      throw new Error(`Invalid recurrence pattern: ${pattern}`);
  }
  
  return date;
}

/**
 * Check if recurrence should continue based on end conditions
 * @param {Date} nextDate - The next occurrence date
 * @param {Date|null} endDate - The recurrence end date (optional)
 * @param {number|null} maxCount - Maximum number of occurrences (optional)
 * @param {number} currentCount - Current number of completed occurrences
 * @returns {boolean} - Whether recurrence should continue
 */
export function shouldContinueRecurrence(nextDate, endDate, maxCount, currentCount) {
  // Check end date constraint
  if (endDate) {
    const endDateTime = new Date(endDate);
    if (nextDate > endDateTime) {
      return false;
    }
  }
  
  // Check count constraint
  if (maxCount && currentCount >= maxCount) {
    return false;
  }
  
  return true;
}

/**
 * Create a new recurring task by copying the completed one
 * @param {object} supabase - Supabase client
 * @param {object} completedTask - The task that was just completed
 * @returns {object} - The newly created task
 */
async function createNextRecurringTask(supabase, completedTask) {
  try {
    // Calculate the next due date
    const currentDueDate = new Date(completedTask.due_date);
    
    // Use stored weekday preference if available
    let weekday = null;
    if ((completedTask.recurrence_pattern === 'weekly' || completedTask.recurrence_pattern === 'biweekly') 
        && completedTask.recurrence_weekday !== null && completedTask.recurrence_weekday !== undefined) {
      weekday = completedTask.recurrence_weekday;
      console.log(`📅 Using stored weekday preference: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]}`);
    }
    
    const nextDate = calculateNextOccurrence(
      currentDueDate,
      completedTask.recurrence_pattern,
      completedTask.recurrence_interval || 1,
      weekday
    );
    
    console.log(`📅 Next occurrence calculated: ${nextDate.toISOString().split('T')[0]}`);
    
    // Calculate next occurrence number (increment)
    const currentOccurrenceNum = completedTask.recurrence_count || 1;
    const maxOccurrences = completedTask.recurrence_max_count;
    const nextOccurrenceNum = currentOccurrenceNum + 1;
    
    if (maxOccurrences !== null && maxOccurrences !== undefined) {
      console.log(`📊 Current occurrence: ${currentOccurrenceNum} of ${maxOccurrences}`);
      
      // If we've reached the max count, stop creating more tasks
      if (currentOccurrenceNum >= maxOccurrences) {
        console.log(`🏁 Recurrence completed for task: ${completedTask.title} (count limit reached: ${currentOccurrenceNum}/${maxOccurrences})`);
        return null;
      }
      console.log(`📊 Next occurrence will be: ${nextOccurrenceNum} of ${maxOccurrences}`);
    }
    
    // Check if we should continue recurring based on end date
    const shouldContinue = shouldContinueRecurrence(
      nextDate,
      completedTask.recurrence_end_date,
      null, // Don't check count here, we already checked above
      1
    );
    
    if (!shouldContinue) {
      console.log(`🏁 Recurrence completed for task: ${completedTask.title} (end date reached)`);
      return null;
    }
    
    // Create a NEW task with the same details but updated due date
    const newTaskData = {
      title: completedTask.title,
      description: completedTask.description,
      due_date: nextDate.toISOString().split('T')[0],
      status: 'ongoing',
      priority: completedTask.priority,
      owner_id: completedTask.owner_id,
      project_id: completedTask.project_id,
      collaborators: completedTask.collaborators,
      file: completedTask.file,
      // Copy recurrence settings
      is_recurring: true,
      recurrence_pattern: completedTask.recurrence_pattern,
      recurrence_interval: completedTask.recurrence_interval,
      recurrence_end_date: completedTask.recurrence_end_date,
      recurrence_count: nextOccurrenceNum, // Incremented count for next task
      recurrence_max_count: maxOccurrences, // Keep the max count
      recurrence_weekday: completedTask.recurrence_weekday,
      recurrence_series_id: completedTask.recurrence_series_id // Keep same series ID
    };
    
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert(newTaskData)
      .select()
      .single();
    
    if (taskError) {
      console.error('Error creating next recurring task:', taskError);
      throw taskError;
    }
    
    console.log(`✅ Created next recurring task: ${newTask.title} (due: ${newTask.due_date})`);
    
    // Copy subtasks if any
    await copySubtasksToNewTask(supabase, completedTask.id, newTask.id);
    
    return newTask;
  } catch (error) {
    console.error('Error in createNextRecurringTask:', error);
    throw error;
  }
}

/**
 * Copy subtasks from one task to another
 * @param {object} supabase - Supabase client
 * @param {number} fromTaskId - Source task ID
 * @param {number} toTaskId - Destination task ID
 */
async function copySubtasksToNewTask(supabase, fromTaskId, toTaskId) {
  try {
    const { data: subtasks, error: fetchError } = await supabase
      .from('sub_task')
      .select('*')
      .eq('main_task_id', fromTaskId);
    
    if (fetchError || !subtasks || subtasks.length === 0) {
      return;
    }
    
    const newSubtasks = subtasks.map(subtask => ({
      main_task_id: toTaskId,
      title: subtask.title,
      description: subtask.description,
      status: 'not started',
      priority: subtask.priority
    }));
    
    const { error: insertError } = await supabase
      .from('sub_task')
      .insert(newSubtasks);
    
    if (insertError) {
      console.error('Error copying subtasks:', insertError);
    } else {
      console.log(`✅ Copied ${newSubtasks.length} subtasks`);
    }
  } catch (error) {
    console.error('Error in copySubtasksToNewTask:', error);
  }
}

/**
 * Handle task completion - create next recurring task if needed
 * @param {object} supabase - Supabase client
 * @param {number} taskId - The completed task ID
 * @returns {object} - Result with next task if created
 */
export async function handleTaskCompletion(supabase, taskId) {
  try {
    // Get the completed task
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      console.error('Task not found:', taskId);
      return {
        success: false,
        error: 'Task not found'
      };
    }

    // Check if this is a recurring task
    if (!task.is_recurring) {
      console.log('Task is not recurring, no action needed');
      return {
        success: true,
        message: 'Task is not recurring'
      };
    }

    console.log(`🔄 Recurring task completed: ${task.title} (due: ${task.due_date})`);
    
    // Create the next recurring task
    const nextTask = await createNextRecurringTask(supabase, task);
    
    if (!nextTask) {
      console.log('🏁 Recurrence series completed - no more tasks will be created');
      return {
        success: true,
        message: 'Recurrence series completed'
      };
    }

    return {
      success: true,
      nextTask: nextTask,
      message: 'Next recurring task created successfully'
    };
  } catch (error) {
    console.error('Error in handleTaskCompletion:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a new recurring task
 * @param {object} supabase - Supabase client
 * @param {object} taskData - The task data including recurrence settings
 * @param {number|null} weekdayPreference - Preferred weekday for weekly/biweekly tasks (0-6)
 * @returns {object} - The created task
 */
export async function createRecurringTask(supabase, taskData, weekdayPreference = null) {
  try {
    const seriesId = randomUUID();
    
    // Store the original max count separately
    const maxCount = taskData.recurrence_count;
    
    // Create a simple recurring task with all the recurrence metadata
    // For the first task, set recurrence_count to 1 (first occurrence)
    const recurringTaskData = {
      ...taskData,
      status: 'ongoing',
      recurrence_series_id: seriesId,
      is_recurring: true,
      recurrence_weekday: weekdayPreference, // Store for future occurrences
      recurrence_count: 1, // This is the 1st occurrence
      recurrence_max_count: maxCount // Store the max count
    };

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert(recurringTaskData)
      .select()
      .single();

    if (taskError) {
      console.error('Error creating recurring task:', taskError);
      throw taskError;
    }

    console.log(`✅ Created recurring task: ${task.title} (due: ${task.due_date}) - Occurrence 1${maxCount ? ` of ${maxCount}` : ''}`);
    
    if (weekdayPreference !== null) {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayPreference];
      console.log(`📅 Will recur on: ${dayName}`);
    }

    return {
      success: true,
      task: task
    };
  } catch (error) {
    console.error('Error in createRecurringTask:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all tasks in a recurring series
 * @param {object} supabase - Supabase client
 * @param {string} seriesId - The recurrence series ID
 * @returns {array} - Array of tasks in the series
 */
export async function getRecurrenceInstances(supabase, seriesId) {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('recurrence_series_id', seriesId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching recurring tasks:', error);
      throw error;
    }

    return tasks || [];
  } catch (error) {
    console.error('Error in getRecurrenceInstances:', error);
    throw error;
  }
}

/**
 * Export all recurrence service functions
 */
const recurrenceService = {
  calculateNextOccurrence,
  shouldContinueRecurrence,
  handleTaskCompletion,
  createRecurringTask,
  getRecurrenceInstances
};

export default recurrenceService;
