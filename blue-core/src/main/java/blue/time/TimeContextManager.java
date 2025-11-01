/*
 * blue - object composition environment for csound
 * Copyright (C) 2025
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.time;

/**
 * Thread-local manager for TimeContext.
 * 
 * Provides access to TimeContext without requiring it to be stored in every object.
 * Each thread maintains its own TimeContext, making this safe for concurrent operations.
 * 
 * Usage:
 * <pre>
 * // Set context before processing
 * TimeContextManager.setContext(project.getTimeContext());
 * try {
 *     // Process score objects
 *     double beats = obj.getStartTime();  // Uses context from manager
 * } finally {
 *     TimeContextManager.clearContext();
 * }
 * 
 * // Or use try-with-resources
 * try (var scope = new TimeContextScope(project.getTimeContext())) {
 *     // Process score objects
 * }
 * </pre>
 * 
 * @author Steven Yi
 */
public class TimeContextManager {
    
    private static final ThreadLocal<TimeContext> CONTEXT = new ThreadLocal<>();
    
    /**
     * Sets the TimeContext for the current thread.
     * This should be called by the Score/Project before processing.
     * 
     * @param context the TimeContext to use for conversions
     * @throws IllegalArgumentException if context is null
     */
    public static void setContext(TimeContext context) {
        if (context == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        CONTEXT.set(context);
    }
    
    /**
     * Gets the TimeContext for the current thread.
     * 
     * @return the TimeContext for this thread
     * @throws IllegalStateException if no TimeContext has been set for this thread
     */
    public static TimeContext getContext() {
        TimeContext context = CONTEXT.get();
        if (context == null) {
            throw new IllegalStateException(
                "No TimeContext set for current thread. " +
                "Call TimeContextManager.setContext() before accessing time conversions.");
        }
        return context;
    }
    
    
    /**
     * Clears the TimeContext for the current thread.
     * Should be called after processing is complete.
     */
    public static void clearContext() {
        CONTEXT.remove();
    }
    
    /**
     * Checks if a TimeContext is currently set for this thread.
     * 
     * @return true if a TimeContext is set, false otherwise
     */
    public static boolean hasContext() {
        return CONTEXT.get() != null;
    }
}
