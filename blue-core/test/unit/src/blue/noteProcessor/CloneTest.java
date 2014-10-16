///*
// * blue - object composition environment for csound
// * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
// *
// * This program is free software; you can redistribute it and/or modify
// * it under the terms of the GNU General Public License as published
// * by  the Free Software Foundation; either version 2 of the License or
// * (at your option) any later version.
// *
// * This program is distributed in the hope that it will be useful, but
// * WITHOUT ANY WARRANTY; without even the implied warranty of
// * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// * GNU General Public License for more details.
// *
// * You should have received a copy of the GNU General Public License
// * along with this program; see the file COPYING.LIB.  If not, write to
// * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
// * Boston, MA  02111-1307 USA
// */
//
//package blue.noteProcessor;
//
//import java.lang.reflect.InvocationTargetException;
//import java.lang.reflect.Method;
//
//import junit.framework.TestCase;
//
//import org.apache.commons.lang.builder.EqualsBuilder;
//import org.apache.commons.lang.builder.ToStringBuilder;
//
//import blue.BlueSystem;
//import blue.utility.ObjectUtilities;
//import electric.xml.Element;
//
///**
// * @author Steven Yi
// */
//public class CloneTest extends TestCase {
//
//    public void testSerialize() {
//        Class[] noteProcessors = BlueSystem.getNoteProcessorClasses();
//
//        for (int i = 0; i < noteProcessors.length; i++) {
//            Class class1 = noteProcessors[i];
//            NoteProcessor np = null;
//
//            try {
//                np = (NoteProcessor) class1.newInstance();
//            } catch (InstantiationException e) {
//                e.printStackTrace();
//            } catch (IllegalAccessException e) {
//                e.printStackTrace();
//            }
//
//            assertNotNull(np);
//
//            if (np == null) {
//                continue;
//            }
//
//            Object obj = ObjectUtilities.clone(np);
//            assertNotNull(obj);
//        }
//
//    }
//
//    public void testClone() {
//        Class[] noteProcessors = BlueSystem.getNoteProcessorClasses();
//
//        for (int i = 0; i < noteProcessors.length; i++) {
//            Class class1 = noteProcessors[i];
//            NoteProcessor np = null;
//
//            try {
//                np = (NoteProcessor) class1.newInstance();
//            } catch (InstantiationException e) {
//                e.printStackTrace();
//            } catch (IllegalAccessException e) {
//                e.printStackTrace();
//            }
//
//            assertNotNull(np);
//
//            if (np == null) {
//                continue;
//            }
//
//            NoteProcessor clone = (NoteProcessor) ObjectUtilities.clone(np);
//
//            boolean isEqual = EqualsBuilder.reflectionEquals(np, clone);
//
//            if (!isEqual) {
//                StringBuffer buffer = new StringBuffer();
//                buffer.append("Problem with class: " + class1.getName() + "\n");
//                buffer.append("Original Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(np) + "\n");
//                buffer.append("Cloned Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(clone) + "\n");
//
//                System.out.println(buffer.toString());
//
//            }
//
//            assertTrue(isEqual);
//
//            Element elem1 = np.saveAsXML();
//
//            Element elem2 = (clone).saveAsXML();
//
//            assertEquals(elem1.getTextString(), elem2.getTextString());
//        }
//
//    }
//
//    public void testLoadSave() {
//        Class[] noteProcessors = BlueSystem.getNoteProcessorClasses();
//
//        for (int i = 0; i < noteProcessors.length; i++) {
//            Class class1 = noteProcessors[i];
//            NoteProcessor np = null;
//
//            try {
//                np = (NoteProcessor) class1.newInstance();
//            } catch (InstantiationException e) {
//                e.printStackTrace();
//            } catch (IllegalAccessException e) {
//                e.printStackTrace();
//            }
//
//            assertNotNull(np);
//
//            if (np == null) {
//                continue;
//            }
//
//            Element elem1 = np.saveAsXML();
//
//            Method m = null;
//            try {
//                m = class1.getMethod("loadFromXML",
//                        new Class[] { Element.class });
//            } catch (SecurityException e1) {
//                // TODO Auto-generated catch block
//                e1.printStackTrace();
//            } catch (NoSuchMethodException e1) {
//                // TODO Auto-generated catch block
//                e1.printStackTrace();
//            }
//
//            NoteProcessor np2 = null;
//
//            assertNotNull(m);
//            if (m == null) {
//                continue;
//            }
//
//            try {
//                np2 = (NoteProcessor) m.invoke(np, new Object[] { elem1 });
//            } catch (IllegalArgumentException e2) {
//                // TODO Auto-generated catch block
//                e2.printStackTrace();
//            } catch (IllegalAccessException e2) {
//                // TODO Auto-generated catch block
//                e2.printStackTrace();
//            } catch (InvocationTargetException e2) {
//                // TODO Auto-generated catch block
//                e2.printStackTrace();
//            }
//
//            boolean isEqual = EqualsBuilder.reflectionEquals(np, np2);
//
//            if (!isEqual) {
//                StringBuffer buffer = new StringBuffer();
//                buffer.append("Problem with class: " + class1.getName() + "\n");
//                buffer.append("Original Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(np) + "\n");
//                buffer.append("Cloned Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(np2) + "\n");
//
//                System.out.println(buffer.toString());
//
//            }
//
//            assertTrue(isEqual);
//
//        }
//
//    }
//
//}