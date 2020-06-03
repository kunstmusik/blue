/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.soundObject.editor.jmask;

import blue.soundObject.jmask.Generator;

/**
 * 
 * @author steven
 */
public interface ParameterEditListener {

    int PARAMETER_ADD_BEFORE = 0;

    int PARAMETER_ADD_AFTER = 1;

    int PARAMETER_REMOVE = 2;

    int PARAMETER_CHANGE_TYPE = 3;
    
    int PARAMETER_PUSH_UP = 4;
    
    int PARAMETER_PUSH_DOWN = 5;

    void parameterEdit(int editType, int parameterNum,
                       Generator generator);

}
