/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.utility;

import blue.BlueSystem;
import blue.SoundObjectLibrary;
import electric.xml.Element;
import java.io.*;
import java.lang.reflect.Method;

public class ObjectUtilities {

    public static Object clone(Object obj) {
        try {
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            ObjectOutputStream objectOutputStream = new ObjectOutputStream(
                    byteArrayOutputStream);
            objectOutputStream.writeObject(obj);
            objectOutputStream.flush();
            byteArrayOutputStream.close();
            byte[] objectBuffer = byteArrayOutputStream.toByteArray();
            ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(
                    objectBuffer);
            ObjectInputStream objectInputStream = new ObjectInputStream(
                    byteArrayInputStream);
            Object myClone = objectInputStream.readObject();
            return myClone;
        } catch (IOException x) {
            x.printStackTrace();
        } catch (ClassNotFoundException x) {
            x.printStackTrace();
        }
        return null;
    }

    public static void printMembers(Object obj) {
        System.out.println(obj.toString());
        Method[] methods = obj.getClass().getMethods();

        for (int i = 0; i < methods.length; i++) {

            try {
                if (methods[i].getName().startsWith("get")
                        || methods[i].getName().startsWith("is")) {
                    System.out.println(methods[i].getName() + " : "
                            + methods[i].invoke(obj, null));
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        System.out.println("\n");
    }

    public static Object loadFromXML(Element elem) throws Exception {
        String npClass = elem.getAttributeValue("type");
        Class classToLoad = BlueSystem.getClassLoader().loadClass(npClass);

        Object retVal = null;

        Method m = classToLoad.getMethod("loadFromXML",
                new Class[] { Element.class });
        retVal = m.invoke(null, new Object[] { elem });

        return retVal;
    }

    public static Object loadFromXML(Element elem,
            SoundObjectLibrary sObjLibrary) throws Exception {
        String npClass = elem.getAttributeValue("type");
        Class classToLoad = BlueSystem.getClassLoader().loadClass(npClass);

        Object retVal = null;

        Method m = classToLoad.getMethod("loadFromXML", new Class[] {
                Element.class, SoundObjectLibrary.class });
        retVal = m.invoke(null, new Object[] { elem, sObjLibrary });

        return retVal;
    }

    public static String getShortClassName(Object obj) {
        String className = obj.getClass().getName();
        String shortName = className.substring(className.lastIndexOf('.') + 1);

        return shortName;
    }

}

//class PluginObjectInputStream extends ObjectInputStream {
//
//    public PluginObjectInputStream(InputStream in) throws IOException {
//        super(in);
//        // TODO Auto-generated constructor stub
//    }
//
//    protected Class resolveClass(ObjectStreamClass desc) throws IOException,
//            ClassNotFoundException {
//        String className = desc.getName();
//
//        PluginClassLoader loader = BlueSystem.getClassLoader();
//
//        Class c = loader.loadClass(className);
//
//        if (c == null) {
//            return super.resolveClass(desc);
//        }
//
//        return c;
//    }
//
//}
