/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
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
package blue.project;

import blue.BlueData;
import javax.swing.JComponent;

/**
 *
 * @author stevenyi
 */
public abstract class ProjectPluginEditor extends JComponent {
    /** Given a ProjectPluginData, editor should configure itself to edit the 
     * data and return true, signaling this editor is the appropriate one for the
     * data, or return false to signal it is not the appropriate editor.
     * 
     * @param data
     * @return 
     */
     public abstract void edit(BlueData data); 

     /** Gets the display name to use for the tab holding this component 
      */
//     public abstract String getProjectPropertiesTabName();
}
