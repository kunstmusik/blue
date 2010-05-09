/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

class BSBLineObjectViewBeanInfo extends SimpleBeanInfo {

    /*
     * (non-Javadoc)
     * 
     * @see java.beans.BeanInfo#getPropertyDescriptors()
     */
    public PropertyDescriptor[] getPropertyDescriptors() {
        try {
            PropertyDescriptor objName = new PropertyDescriptor("objectName",
                    BSBLineObjectView.class);

            PropertyDescriptor cWidth = new PropertyDescriptor("canvasWidth",
                    BSBLineObjectView.class);

            PropertyDescriptor cHeight = new PropertyDescriptor("canvasHeight",
                    BSBLineObjectView.class);

            // PropertyDescriptor xMin = new PropertyDescriptor("xMin",
            // BSBLineObjectView.class);
            //
            // PropertyDescriptor xMax = new PropertyDescriptor("xMax",
            // BSBLineObjectView.class);
            //
            // PropertyDescriptor yMin = new PropertyDescriptor("yMin",
            // BSBLineObjectView.class);

            PropertyDescriptor yMax = new PropertyDescriptor("xMax",
                    BSBLineObjectView.class);

            PropertyDescriptor separatorType = new PropertyDescriptor(
                    "separatorType", BSBLineObjectView.class);
            separatorType
                    .setPropertyEditorClass(SeparatorTypePropertyEditor.class);

            PropertyDescriptor relative = new PropertyDescriptor(
                    "relativeXValues", BSBLineObjectView.class);

            PropertyDescriptor leadingZero = new PropertyDescriptor(
                    "leadingZero", BSBLineObjectView.class);

            PropertyDescriptor locked = new PropertyDescriptor("locked",
                    BSBLineObjectView.class);
            locked.setDisplayName("Points Locked");

            PropertyDescriptor items = new PropertyDescriptor("lineObjectView",
                    BSBLineObjectView.class);

            items.setPropertyEditorClass(LineListPropertyEditor.class);
            items.setDisplayName("Edit Lines");

            return new PropertyDescriptor[] { objName, cWidth, cHeight,
            // xMin, xMax, yMin,
                    yMax, separatorType, relative, leadingZero, locked, items };
        } catch (IntrospectionException e) {
            e.printStackTrace();
        }
        return null;

    }
}
