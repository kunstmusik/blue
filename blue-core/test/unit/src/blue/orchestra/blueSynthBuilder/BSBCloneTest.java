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
package blue.orchestra.blueSynthBuilder;

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import junit.framework.TestCase;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class BSBCloneTest extends TestCase {

    public void testSerialize() {
        BSBObjectEntry[] bsbObjects = BSBObjectRegistry.getBSBObjects();

        for (int i = 0; i < bsbObjects.length; i++) {
            BSBObjectEntry entry = bsbObjects[i];

            Class class1 = entry.bsbObjectClass;

            BSBObject bsbObj = null;

            try {
                bsbObj = (BSBObject) class1.newInstance();
            } catch (InstantiationException e) {
                e.printStackTrace();
            } catch (IllegalAccessException e) {
                e.printStackTrace();
            }

            assertNotNull(bsbObj);

            if (bsbObj == null) {
                continue;
            }

            Object obj = ObjectUtilities.clone(bsbObj);
            assertNotNull(obj);
        }

    }

    public void testClone() {
        BSBObjectEntry[] bsbObjects = BSBObjectRegistry.getBSBObjects();

        for (int i = 0; i < bsbObjects.length; i++) {
            BSBObjectEntry entry = bsbObjects[i];

            Class class1 = entry.bsbObjectClass;

            BSBObject bsbObj = null;

            try {
                bsbObj = (BSBObject) class1.newInstance();
            } catch (InstantiationException e) {
                e.printStackTrace();
            } catch (IllegalAccessException e) {
                e.printStackTrace();
            }

            assertNotNull(bsbObj);

            if (bsbObj == null) {
                continue;
            }

            Object obj = ObjectUtilities.clone(bsbObj);
            assertNotNull(obj);

            boolean isEqual = EqualsBuilder.reflectionEquals(bsbObj, obj);

            if (!isEqual) {
                StringBuilder buffer = new StringBuilder();
                buffer.append("Problem with class: ").append(class1.getName()).append("\n");
                buffer.append("Original Object\n");
                buffer.append(ToStringBuilder.reflectionToString(bsbObj))
                        .append("\n");
                buffer.append("Cloned Object\n");
                buffer.append(ToStringBuilder.reflectionToString(obj)).append("\n");

                System.out.println(buffer.toString());

            }

            assertTrue(isEqual);

            Element elem1 = bsbObj.saveAsXML();

            Element elem2 = ((BSBObject) obj).saveAsXML();

            assertEquals(elem1.getTextString(), elem2.getTextString());
        }

    }

    public void testLoadSave() {
        BSBObjectEntry[] bsbObjects = BSBObjectRegistry.getBSBObjects();

        for (int i = 0; i < bsbObjects.length; i++) {
            BSBObjectEntry entry = bsbObjects[i];

            Class class1 = entry.bsbObjectClass;

            BSBObject bsbObj = null;

            try {
                bsbObj = (BSBObject) class1.newInstance();
            } catch (InstantiationException e) {
                e.printStackTrace();
            } catch (IllegalAccessException e) {
                e.printStackTrace();
            }

            assertNotNull(bsbObj);

            if (bsbObj == null) {
                continue;
            }

            Element elem1 = bsbObj.saveAsXML();

            Method m = null;
            try {
                m = class1.getMethod("loadFromXML",
                        new Class[] { Element.class });
            } catch (SecurityException e1) {
                // TODO Auto-generated catch block
                e1.printStackTrace();
            } catch (NoSuchMethodException e1) {
                // TODO Auto-generated catch block
                e1.printStackTrace();
            }

            BSBObject bsbObj2 = null;

            assertNotNull(m);
            if (m == null) {
                continue;
            }

            try {
                bsbObj2 = (BSBObject) m.invoke(bsbObj, new Object[] { elem1 });
            } catch (IllegalArgumentException e2) {
                // TODO Auto-generated catch block
                e2.printStackTrace();
            } catch (IllegalAccessException e2) {
                // TODO Auto-generated catch block
                e2.printStackTrace();
            } catch (InvocationTargetException e2) {
                // TODO Auto-generated catch block
                e2.printStackTrace();
            }

            boolean isEqual = EqualsBuilder.reflectionEquals(bsbObj, bsbObj2);

            if (!isEqual) {
                StringBuilder buffer = new StringBuilder();
                buffer.append("Problem with class: ").append(class1.getName()).append("\n");
                buffer.append("Original Object\n");
                buffer.append(ToStringBuilder.reflectionToString(bsbObj))
                        .append("\n");
                buffer.append("Cloned Object\n");
                buffer.append(ToStringBuilder.reflectionToString(bsbObj2)).append("\n");

                System.out.println(buffer.toString());

            }

            assertTrue(isEqual);

        }

    }
}
