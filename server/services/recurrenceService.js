/**
 * Recurrence Service
 * Handles all recurring task logic including:
 * - Calculating next occurrence dates
 * - Generating next task instances
 * - Managing recurrence series
 * - Checking recurrence end conditions
 */

import { randomUUID } from 'crypto';

/**
 * Calculate the next occurrence of a specific weekday
 * @param {Date} fromDate - The date to start from
 * @param {number} targetWeekday - Target day of week (0 = Sunday, 6 = Saturday)
 * @param {number} weeksToAdd - Number of additional weeks to add (0 for next/same week occurrence)
 * @returns {Date} - The next occurrence of the target weekday
 */
function getNextWeekday(fromDate, targetWeekday, weeksToAdd = 0) {
  const date = new Date(fromDate);
  const currentWeekday = date.getDay();
  
  console.log(`🔍 getNextWeekday: from ${date.toISOString().split('T')[0]} (day ${currentWeekday}) to day ${targetWeekday}, +${weeksToAdd} weeks`);
  
  // Calculate days until target weekday
  let daysToAdd = targetWeekday - currentWeekday;
  
  // If target day is today or in the past this week, go to next week (unless it's the same day)
  if (daysToAdd < 0) {
    daysToAdd += 7;
  } else if (daysToAdd === 0 && weeksToAdd === 0) {
    // If it's the same day and we want first occurrence, use today
    daysToAdd = 0;
  }
  
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
        // Use specific weekday - add the specified number of weeks
        return getNextWeekday(date, weekday, interval);
      } else {
        // Default: add weeks from current date
        date.setDate(date.getDate() + (7 * interval));
      }
      break;
      
    case 'biweekly':
      if (weekday !== null && weekday !== undefined) {
        // Use specific weekday - add the specified number of 2-week periods
        return getNextWeekday(date, weekday, interval * 2);
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
 * Create the next instance of a recurring task
 * @param {object} supabase - Supabase client
 * @param {object} masterTask - The master recurring task
 * @param {Date} nextDate - The next occurrence date
 * @param {number} instanceNumber - The instance number in the series
 * @returns {object} - The created task instance
 */
export async function createNextTaskInstance(supabase, masterTask, nextDate, instanceNumber) {
  try {
    // Prepare the new task instance data
    const newTaskData = {
      title: masterTask.title,
      description: masterTask.description,
      due_date: nextDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      status: 'ongoing',
      priority: masterTask.priority,
      owner_id: masterTask.owner_id,
      project_id: masterTask.project_id,
      parent_recurrence_id: masterTask.id,
      recurrence_series_id: masterTask.recurrence_series_id,
      collaborators: masterTask.collaborators,
      file: masterTask.file
    };

    // Create the new task instance
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert(newTaskData)
      .select()
      .single();

    if (taskError) {
      console.error('Error creating next task instance:', taskError);
      throw taskError;
    }

    console.log(`✅ Created task instance #${instanceNumber} for ${masterTask.title}`);

    // Create history record
    const { error: historyError } = await supabase
      .from('task_recurrence_history')
      .insert({
        original_task_id: masterTask.id,
        recurrence_series_id: masterTask.recurrence_series_id,
        instance_number: instanceNumber,
        scheduled_date: nextDate.toISOString().split('T')[0],
        status: 'active'
      });

    if (historyError) {
      console.error('Error creating recurrence history:', historyError);
      // Don't throw - the task was created successfully
    }

    // If master task has subtasks, copy them to the new instance
    if (masterTask.id) {
      await copySubtasksToNewInstance(supabase, masterTask.id, newTask.id, masterTask.recurrence_series_id);
    }

    return newTask;
  } catch (error) {
    console.error('Error in createNextTaskInstance:', error);
    throw error;
  }
}

/**
 * Copy subtasks from master task to new instance
 * @param {object} supabase - Supabase client
 * @param {number} masterTaskId - The master task ID
 * @param {number} newTaskId - The new task instance ID
 * @param {string} seriesId - The recurrence series ID
 */
async function copySubtasksToNewInstance(supabase, masterTaskId, newTaskId, seriesId) {
  try {
    // Get subtasks from master task
    const { data: subtasks, error: fetchError } = await supabase
      .from('sub_task')
      .select('*')
      .eq('main_task_id', masterTaskId)
      .eq('inherits_recurrence', true);

    if (fetchError || !subtasks || subtasks.length === 0) {
      return; // No subtasks to copy or error occurred
    }

    // Create copies for the new task instance
    const newSubtasks = subtasks.map(subtask => ({
      main_task_id: newTaskId,
      title: subtask.title,
      description: subtask.description,
      status: 'not started', // Reset status for new instance
      priority: subtask.priority,
      inherits_recurrence: true,
      recurrence_series_id: seriesId
    }));

    const { error: insertError } = await supabase
      .from('sub_task')
      .insert(newSubtasks);

    if (insertError) {
      console.error('Error copying subtasks:', insertError);
    } else {
      console.log(`✅ Copied ${newSubtasks.length} subtasks to new instance`);
    }
  } catch (error) {
    console.error('Error in copySubtasksToNewInstance:', error);
  }
}

/**
 * Handle task completion and generate next instance if needed
 * @param {object} supabase - Supabase client
 * @param {number} taskId - The completed task ID
 * @returns {object|null} - The next task instance or null if no more occurrences
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

    // Check if this is a recurring task instance
    if (!task.parent_recurrence_id && !task.is_recurring) {
      // Not a recurring task
      return {
        success: true,
        message: 'Task is not recurring'
      };
    }

    // Determine if this is the master task or an instance
    const isMasterTask = task.is_recurring && !task.parent_recurrence_id;
    const masterTaskId = task.parent_recurrence_id || task.id;
    
    // Get the master recurring task (if this is an instance)
    let masterTask;
    if (isMasterTask) {
      masterTask = task; // This IS the master task
      console.log(`🔄 Completing MASTER recurring task: ${task.title}`);
    } else {
      const { data: fetchedMaster, error: masterError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', masterTaskId)
        .single();

      if (masterError || !fetchedMaster || !fetchedMaster.is_recurring) {
        console.error('Master recurring task not found or invalid');
        return {
          success: false,
          error: 'Master recurring task not found'
        };
      }
      masterTask = fetchedMaster;
      console.log(`🔄 Completing instance of recurring task: ${task.title}`);
    }

    // Update the history record for this completion (if it's an instance, not the master)
    if (!isMasterTask) {
      const { error: historyUpdateError } = await supabase
        .from('task_recurrence_history')
        .update({
          status: 'completed',
          completed_date: new Date().toISOString()
        })
        .eq('original_task_id', masterTask.id)
        .eq('scheduled_date', task.due_date);

      if (historyUpdateError) {
        console.error('Error updating history:', historyUpdateError);
      }
    } else {
      // This is the master task being completed for the first time
      console.log(`✅ First completion of recurring series: ${masterTask.title}`);
    }

    // Calculate next occurrence date
    const currentDueDate = new Date(task.due_date);
    
    console.log(`🔄 Task completed: ${task.title}, due_date: ${task.due_date}`);
    console.log(`🔄 Master task pattern: ${masterTask.recurrence_pattern}, interval: ${masterTask.recurrence_interval}`);
    
    // For weekly/biweekly tasks, maintain the same day of week
    let weekday = null;
    if (masterTask.recurrence_pattern === 'weekly' || masterTask.recurrence_pattern === 'biweekly') {
      // Extract the weekday from the current task's due date
      weekday = currentDueDate.getDay();
      console.log(`📅 Extracted weekday from due_date: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]}`);
    }
    
    const nextDate = calculateNextOccurrence(
      currentDueDate,
      masterTask.recurrence_pattern,
      masterTask.recurrence_interval || 1,
      weekday
    );
    
    console.log(`📅 Calculated next occurrence: ${nextDate.toISOString().split('T')[0]}`);

    // Get current instance count
    // If this is the master task, start at 0; otherwise get the highest instance number
    let nextInstanceNumber;
    if (isMasterTask) {
      nextInstanceNumber = 1; // First actual instance
    } else {
      const { data: historyRecords } = await supabase
        .from('task_recurrence_history')
        .select('instance_number')
        .eq('original_task_id', masterTask.id)
        .order('instance_number', { ascending: false })
        .limit(1);

      const currentInstanceNumber = historyRecords?.[0]?.instance_number || 0;
      nextInstanceNumber = currentInstanceNumber + 1;
    }
    
    console.log(`🔢 Creating instance number: ${nextInstanceNumber}`);

    // Check if recurrence should continue
    const shouldContinue = shouldContinueRecurrence(
      nextDate,
      masterTask.recurrence_end_date,
      masterTask.recurrence_count,
      nextInstanceNumber
    );

    if (!shouldContinue) {
      console.log(`🏁 Recurrence completed for task: ${masterTask.title}`);
      
      // Mark master task as completed (if it's not already)
      if (!isMasterTask) {
        await supabase
          .from('tasks')
          .update({
            status: 'completed',
            next_occurrence_date: null,
            last_completed_date: new Date().toISOString()
          })
          .eq('id', masterTask.id);
      }

      return {
        success: true,
        message: 'Recurrence series completed'
      };
    }

    // Create next instance
    const nextTask = await createNextTaskInstance(
      supabase,
      masterTask,
      nextDate,
      nextInstanceNumber
    );

    // Update master task with next occurrence info and ensure it stays as template
    await supabase
      .from('tasks')
      .update({
        status: 'recurring_template', // Keep as template
        next_occurrence_date: nextDate.toISOString().split('T')[0],
        last_completed_date: new Date().toISOString()
      })
      .eq('id', masterTask.id);

    console.log(`🔄 Generated next occurrence for: ${masterTask.title} on ${nextDate.toISOString().split('T')[0]}`);

    return {
      success: true,
      nextTask: nextTask,
      message: 'Next instance created successfully'
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
 * Create a new recurring task series
 * @param {object} supabase - Supabase client
 * @param {object} taskData - The task data including recurrence settings (must include owner_id)
 * @param {number|null} weekdayPreference - Preferred weekday for weekly/biweekly tasks (0-6, not stored in DB)
 * @returns {object} - The created master task and first instance
 */
export async function createRecurringTask(supabase, taskData, weekdayPreference = null) {
  try {
    const seriesId = randomUUID();
    
    // For weekly/biweekly tasks with weekday preference, adjust the due_date to match that weekday
    let adjustedDueDate = taskData.due_date;
    if (weekdayPreference !== null && 
        (taskData.recurrence_pattern === 'weekly' || taskData.recurrence_pattern === 'biweekly')) {
      // Calculate the next occurrence of the preferred weekday
      const baseDate = new Date(taskData.due_date);
      const nextWeekdayDate = getNextWeekday(baseDate, weekdayPreference, 0);
      adjustedDueDate = nextWeekdayDate.toISOString().split('T')[0];
      console.log(`📅 Adjusted due date to match ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayPreference]}: ${adjustedDueDate}`);
    }

    // Create the master task (template)
    const masterTaskData = {
      ...taskData,
      due_date: adjustedDueDate, // Use adjusted date
      status: 'recurring_template',
      recurrence_series_id: seriesId,
      next_occurrence_date: adjustedDueDate,
      is_recurring: true
    };

    const { data: masterTask, error: masterError } = await supabase
      .from('tasks')
      .insert(masterTaskData)
      .select()
      .single();

    if (masterError) {
      console.error('Error creating master recurring task:', masterError);
      throw masterError;
    }

    console.log(`✅ Created master recurring task: ${masterTask.title}`);

    // Calculate when the FIRST instance should be due
    const baseDueDate = new Date(masterTask.due_date);
    
    // Extract weekday for weekly/biweekly patterns
    let weekday = null;
    if (masterTask.recurrence_pattern === 'weekly' || masterTask.recurrence_pattern === 'biweekly') {
      weekday = baseDueDate.getDay();
    }
    
    // Calculate NEXT occurrence date for tracking purposes
    const firstInstanceDate = calculateNextOccurrence(
      baseDueDate,
      masterTask.recurrence_pattern,
      masterTask.recurrence_interval || 1,
      weekday
    );
    
    console.log(`📅 First instance will be created when master is completed: ${firstInstanceDate.toISOString().split('T')[0]}`);

    // DON'T create the first instance yet - it will be created when the master task is completed
    // Update master task to show next occurrence date
    await supabase
      .from('tasks')
      .update({ 
        next_occurrence_date: baseDueDate.toISOString().split('T')[0],
        status: 'ongoing' // Change master to ongoing so it appears in task list
      })
      .eq('id', masterTask.id);

    // Return the master task itself as the first "instance" - user will work on this
    // When they complete it, the actual first recurring instance will be created
    const updatedMaster = {
      ...masterTask,
      status: 'ongoing',
      next_occurrence_date: baseDueDate.toISOString().split('T')[0]
    };

    return {
      success: true,
      task: updatedMaster,  // Return master task as the working task
      masterTask: masterTask  // Also include master task for reference
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
 * Update a recurring task series
 * @param {object} supabase - Supabase client
 * @param {number} taskId - The master task ID
 * @param {object} updates - The updates to apply
 * @returns {object} - The updated master task
 */
export async function updateRecurringTask(supabase, taskId, updates) {
  try {
    // Update the master task
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('is_recurring', true)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating recurring task:', updateError);
      throw updateError;
    }

    console.log(`✅ Updated recurring task: ${updatedTask.title}`);

    return updatedTask;
  } catch (error) {
    console.error('Error in updateRecurringTask:', error);
    throw error;
  }
}

/**
 * Delete a recurring task series
 * @param {object} supabase - Supabase client
 * @param {number} masterTaskId - The master task ID
 * @param {boolean} deleteAllInstances - Whether to delete all instances or just future ones
 * @returns {object} - Deletion result
 */
export async function deleteRecurringTask(supabase, masterTaskId, deleteAllInstances = false) {
  try {
    const { data: masterTask, error: fetchError } = await supabase
      .from('tasks')
      .select('recurrence_series_id')
      .eq('id', masterTaskId)
      .single();

    if (fetchError || !masterTask) {
      throw new Error('Master task not found');
    }

    if (deleteAllInstances) {
      // Delete all tasks in the series
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('recurrence_series_id', masterTask.recurrence_series_id);

      if (deleteError) throw deleteError;

      console.log('✅ Deleted all instances of recurring task');
    } else {
      // Delete only future instances (not completed ones)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('recurrence_series_id', masterTask.recurrence_series_id)
        .in('status', ['ongoing', 'unassigned', 'under review']);

      if (deleteError) throw deleteError;

      // Delete the master task
      const { error: masterDeleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', masterTaskId);

      if (masterDeleteError) throw masterDeleteError;

      console.log('✅ Deleted master task and future instances');
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteRecurringTask:', error);
    throw error;
  }
}

/**
 * Get recurrence history for a task
 * @param {object} supabase - Supabase client
 * @param {number} masterTaskId - The master task ID
 * @returns {array} - Array of history records
 */
export async function getRecurrenceHistory(supabase, masterTaskId) {
  try {
    const { data: history, error } = await supabase
      .from('task_recurrence_history')
      .select('*')
      .eq('original_task_id', masterTaskId)
      .order('instance_number', { ascending: true });

    if (error) {
      console.error('Error fetching recurrence history:', error);
      throw error;
    }

    return history || [];
  } catch (error) {
    console.error('Error in getRecurrenceHistory:', error);
    throw error;
  }
}

/**
 * Get all instances of a recurring task series
 * @param {object} supabase - Supabase client
 * @param {string} seriesId - The recurrence series ID
 * @returns {array} - Array of task instances
 */
export async function getRecurrenceInstances(supabase, seriesId) {
  try {
    const { data: instances, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('recurrence_series_id', seriesId)
      .neq('status', 'recurring_template')
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching recurrence instances:', error);
      throw error;
    }

    return instances || [];
  } catch (error) {
    console.error('Error in getRecurrenceInstances:', error);
    throw error;
  }
}

/**
 * Get all active recurring task templates
 * @param {object} supabase - Supabase client
 * @returns {object} - Object with success flag and tasks array
 */
export async function getActiveRecurringTasks(supabase) {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'recurring_template')
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active recurring tasks:', error);
      return {
        success: false,
        error: error.message,
        tasks: []
      };
    }

    return {
      success: true,
      tasks: tasks || []
    };
  } catch (error) {
    console.error('Error in getActiveRecurringTasks:', error);
    return {
      success: false,
      error: error.message,
      tasks: []
    };
  }
}

/**
 * Export all recurrence service functions
 */
const recurrenceService = {
  calculateNextOccurrence,
  shouldContinueRecurrence,
  createNextTaskInstance,
  handleTaskCompletion,
  createRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  getRecurrenceHistory,
  getRecurrenceInstances,
  getActiveRecurringTasks
};

export default recurrenceService;
