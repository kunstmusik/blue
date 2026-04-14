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
 * Singleton manager for TimeContext.
 *
 * Provides access to TimeContext without requiring it to be stored in every object.
 * Uses a volatile singleton pattern to ensure thread safety while avoiding threading
 * issues in UI painting operations.
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
 * @author Steven Yi
 */
public class TimeContextManager {
    
    private static volatile TimeContext context;
    
    /**
     * Sets the TimeContext for the application.
     * This should be called by the Score/Project before processing.
     *
     * @param newContext the TimeContext to use for conversions
     * @throws IllegalArgumentException if context is null
     */
    public static void setContext(TimeContext newContext) {
        if (newContext == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        context = newContext;
    }
    
    /**
     * Gets the TimeContext for the application.
     *
     * @return the TimeContext for the application
     * @throws IllegalStateException if no TimeContext has been set
     */
    public static TimeContext getContext() {
        if (context == null) {
            throw new IllegalStateException(
                "No TimeContext set. " +
                "Call TimeContextManager.setContext() before accessing time conversions.");
        }
        return context;
    }
    
    
    /**
     * Clears the TimeContext.
     * Should be called after processing is complete.
     */
    public static void clearContext() {
        context = null;
    }
    
    /**
     * Checks if a TimeContext is currently set.
     *
     * @return true if a TimeContext is set, false otherwise
     */
    public static boolean hasContext() {
        return context != null;
    }
}
