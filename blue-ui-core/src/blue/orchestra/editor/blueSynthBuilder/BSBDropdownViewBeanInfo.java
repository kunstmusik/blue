/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.orchestra.editor.blueSynthBuilder;

import java.beans.IntrospectionException;
import java.beans.PropertyDescriptor;
import java.beans.SimpleBeanInfo;

class BSBDropdownViewBeanInfo extends SimpleBeanInfo {

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.BeanInfo#getPropertyDescriptors()
     */
    public PropertyDescriptor[] getPropertyDescriptors() {
        try {
            PropertyDescriptor objName = new PropertyDescriptor("objectName",
                    BSBDropdownView.class);
            PropertyDescriptor items = new PropertyDescriptor("dropdownView",
                    BSBDropdownView.class);
            PropertyDescriptor automatable = new PropertyDescriptor(
                    "automationAllowed", BSBDropdownView.class);
            PropertyDescriptor randomizable = new PropertyDescriptor(
                    "randomizable", BSBDropdownView.class);

            items.setPropertyEditorClass(DropdownItemsPropertyEditor.class);

            return new PropertyDescriptor[] { objName, items, automatable, randomizable };
        } catch (IntrospectionException e) {
            e.printStackTrace();
        }
        return null;

    }
}