/*
 * blue - object composition environment for csound
 * Copyright (C) 2018 stevenyi
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
package blue.ui.core.score;

import blue.components.lines.Line;

/**
 *
 * @author stevenyi
 */
public class SingleLineScoreSelection {

    public Line sourceLine = null;
    public double startTime = -1.0;
    public double endTime = -1.0;
    
    private static final SingleLineScoreSelection INSTANCE;

    static {
        INSTANCE= new SingleLineScoreSelection();
    }

    private SingleLineScoreSelection(){}
    
    public static synchronized SingleLineScoreSelection getInstance() {
        return INSTANCE;
    }

    public void clear() {
        sourceLine = null;
        startTime = -1.0;
        endTime = -1.0;
    } 
}
