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

/**
 * Interface for creating project plugins that augment the features of the 
 * standard BlueData. Project plugins may have user interfaces that are shown
 * as tabs within the Project Properties window.  Plugins may also participate
 * in the lifecycle of a BlueData project. 
 *
 * @author stevenyi
 */
public interface ProjectPlugin {

    /** Called prior to compilation of a Blue Project into a CSD. This will be
     * called when rendering a CSD to disk or compiling a CSD before rendering
     * in realtime or with BlueLive.
     */
    public void preRender(BlueData data);         

}
