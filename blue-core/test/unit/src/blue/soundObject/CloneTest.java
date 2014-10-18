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
//package blue.soundObject;
//
//import java.lang.reflect.InvocationTargetException;
//import java.lang.reflect.Method;
//import java.util.ArrayList;
//
//import junit.framework.TestCase;
//
//import org.apache.commons.lang.builder.EqualsBuilder;
//import org.apache.commons.lang.builder.ToStringBuilder;
//
//import blue.BlueSystem;
//import blue.SoundObjectLibrary;
//import blue.soundObject.tracker.Track;
//import blue.soundObject.tracker.TrackerNote;
//import blue.utility.ObjectUtilities;
//import electric.xml.Element;
//
///**
// * TODO - These tests need to randomly set values of objects to know if
// * deserialization is really happening correctly
// *
// * @author Steven Yi
// */
//public class CloneTest extends TestCase {
//
//    ArrayList soundObjects = new ArrayList();
//
//    protected void setUp() throws Exception {
//        super.setUp();
//
//        Class[] soundObjClasses = BlueSystem.getSoundObjectClasses();
//
//        for (int i = 0; i < soundObjClasses.length; i++) {
//            Class class1 = soundObjClasses[i];
//            SoundObject sObj = null;
//
//            try {
//                sObj = (SoundObject) class1.newInstance();
//            } catch (InstantiationException e) {
//                e.printStackTrace();
//            } catch (IllegalAccessException e) {
//                e.printStackTrace();
//            }
//
//            /* EXTRA INITIALIZATION */
//            if (sObj instanceof TrackerObject) {
//                TrackerObject tracker = (TrackerObject) sObj;
//                Track tr = new Track();
//
//                tracker.getTracks().addTrack(tr);
//
//                TrackerNote tn = tr.getTrackerNote(0);
//
//                tn.setTied(true);
//                tn.setValue(1, "8.00");
//                tn.setValue(2, "80");
//
//            }
//
//            soundObjects.add(sObj);
//        }
//    }
//
//    protected void tearDown() throws Exception {
//        super.tearDown();
//
//        soundObjects.clear();
//        soundObjects = null;
//    }
//
//    public void testSerialize() {
//
//        for (int i = 0; i < soundObjects.size(); i++) {
//            SoundObject sObj = (SoundObject) soundObjects.get(i);
//
//            assertNotNull(sObj);
//
//            if (sObj == null) {
//                continue;
//            }
//
//            Object obj = ObjectUtilities.clone(sObj);
//            assertNotNull(obj);
//        }
//
//    }
//
//    public void testClone() {
//        SoundObjectLibrary sObjLib = new SoundObjectLibrary();
//
//        for (int i = 0; i < soundObjects.size(); i++) {
//            SoundObject sObj = (SoundObject) soundObjects.get(i);
//
//            assertNotNull(sObj);
//
//            if (sObj == null) {
//                continue;
//            }
//
//            // Method[] methods = sObj.getClass().getDeclaredMethods();
//            //
//            // for (int j = 0; j < methods.length; j++) {
//            // Method method = methods[j];
//            //
//            // method.get
//            // }
//
//            SoundObject clone = (SoundObject) sObj.clone();
//
//            boolean isEqual = EqualsBuilder.reflectionEquals(sObj, clone);
//
//            if (!isEqual) {
//                StringBuffer buffer = new StringBuffer();
//                buffer.append("Problem with class: ").append(
//                        sObj.getClass().getName()).append("\n");
//                buffer.append("Original Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(sObj)).append(
//                        "\n");
//                buffer.append("Cloned Object\n");
//                if (clone == null) {
//                    buffer.append("[null]\n");
//                } else {
//                    buffer.append(ToStringBuilder.reflectionToString(clone))
//                            .append("\n");
//                }
//
//                System.out.println(buffer.toString());
//
//            }
//
//            assertTrue(isEqual);
//
//            Element elem1 = sObj.saveAsXML(sObjLib);
//
//            Element elem2 = (clone).saveAsXML(sObjLib);
//
//            assertEquals(elem1.getTextString(), elem2.getTextString());
//        }
//
//    }
//
//    public void testCloneWithRepetition() {
//        SoundObjectLibrary sObjLib = new SoundObjectLibrary();
//
//        for (int i = 0; i < soundObjects.size(); i++) {
//            SoundObject sObj = (SoundObject) soundObjects.get(i);
//
//            assertNotNull(sObj);
//
//            if (sObj == null) {
//                continue;
//            }
//
//            if (sObj.getTimeBehavior() != SoundObject.TIME_BEHAVIOR_NOT_SUPPORTED) {
//                sObj.setTimeBehavior(SoundObject.TIME_BEHAVIOR_REPEAT);
//                sObj.setRepeatPoint(2.0f);
//            } else {
//                continue;
//            }
//
//            SoundObject sObjClone = (SoundObject) sObj.clone();
//
//            Element elem1 = sObj.saveAsXML(sObjLib);
//            Element elem2 = sObjClone.saveAsXML(sObjLib);
//
//            assertEquals(elem1.getTextString(), elem2.getTextString());
//            assertTrue(sObj.getRepeatPoint() == sObjClone.getRepeatPoint());
//        }
//
//    }
//
//    public void testLoadSave() {
//        for (int i = 0; i < soundObjects.size(); i++) {
//            SoundObject sObj = (SoundObject) soundObjects.get(i);
//
//            assertNotNull(sObj);
//
//            if (sObj == null) {
//                continue;
//            }
//
//            SoundObjectLibrary sObjLib = new SoundObjectLibrary();
//
//            Element elem1 = sObj.saveAsXML(sObjLib);
//
//            Method m = null;
//            try {
//                m = sObj.getClass()
//                        .getMethod(
//                                "loadFromXML",
//                                new Class[] { Element.class,
//                                        SoundObjectLibrary.class });
//            } catch (SecurityException e1) {
//                // TODO Auto-generated catch block
//                e1.printStackTrace();
//            } catch (NoSuchMethodException e1) {
//                // TODO Auto-generated catch block
//                e1.printStackTrace();
//            }
//
//            SoundObject sObj2 = null;
//
//            assertNotNull(m);
//            if (m == null) {
//                continue;
//            }
//
//            try {
//                sObj2 = (SoundObject) m.invoke(sObj, new Object[] { elem1,
//                        sObjLib });
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
//            boolean isEqual = EqualsBuilder.reflectionEquals(sObj, sObj2);
//
//            if (!isEqual) {
//                StringBuffer buffer = new StringBuffer();
//                buffer.append("Problem with class: ").append(
//                        sObj.getClass().getName()).append("\n");
//                buffer.append("Original Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(sObj)).append(
//                        "\n");
//
//                Element sObjXML = sObj.saveAsXML(new SoundObjectLibrary());
//                Element sObjXML2 = sObj2.saveAsXML(new SoundObjectLibrary());
//
//                buffer.append("Cloned Object\n");
//                buffer.append(ToStringBuilder.reflectionToString(sObj2))
//                        .append("\n");
//
//                System.out.println(buffer.toString());
//
//                if (!sObjXML.toString().equals(sObjXML2.toString())) {
//                    System.out.println("XML String Unequal\n");
//                    buffer.append(sObjXML);
//                    buffer.append(sObjXML2);
//                }
//            }
//
//            assertTrue(isEqual);
//
//        }
//
//    }
//
//}