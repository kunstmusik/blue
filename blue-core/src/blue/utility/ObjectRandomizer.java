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
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.utility;

import blue.BlueData;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.rmi.dgc.VMID;

/**
 * Randomizes all values in Object, descending into child objects. Useful for
 * randomizing values of objects before testing serialization so that default
 * values won't be used for check.
 * 
 * NOTE: This was an experiment and is now abandoned as it seems not possible to
 * implement.
 * 
 * @author steven
 */
public class ObjectRandomizer {

    public static void randomize(Object obj) {
        Method[] methods = obj.getClass().getMethods();

        for (int i = 0; i < methods.length; i++) {

            if (!methods[i].getName().startsWith("set")) {
                continue;
            }

            Class[] params = methods[i].getParameterTypes();

            if (params.length != 1) {
                continue;
            }

            Class argClass = params[0];

            // System.out.println(fields[i]);

            try {

                if (argClass.isArray()) {

                    System.err.println("Is Array: " + methods[i]);
                    // int len = Array.getLength(obj);
                    //
                    // for (int j = 0; j < len; j++) {
                    //
                    // if (declaringClass == Integer.class) {
                    // Array.setInt(obj, j, (int) (100 * Math.random()));
                    // } else if (declaringClass == Float.class) {
                    // Array.setFloat(obj, j, (float) (100.0f * Math
                    // .random()));
                    // } else if (declaringClass == Double.class) {
                    // Array.setDouble(obj, j, 100.0 * Math.random());
                    // } else if (declaringClass == Boolean.class) {
                    // Array
                    // .setBoolean(obj, j, !methods[i]
                    // .gegetBoolean(obj));
                    // } else if (declaringClass == Long.class) {
                    // Array
                    // .setLong(obj, j, (long) (100L * Math
                    // .random()));
                    // } else if (declaringClass == String.class) {
                    // String str = getRandomString();
                    // System.out.println(str);
                    //
                    // Array.set(obj, j, str);
                    // } else if (declaringClass == Character.class) {
                    // Array.setChar(obj, j, (char) (Math.random() * 127));
                    // } else {
                    // Object obj2 = Array.get(obj, j);
                    //
                    // if (obj2 != null) {
                    // ObjectRandomizer.randomizeFields(obj2);
                    // }
                    // }
                    //
                    // }
                } else {

                    if (argClass == Integer.class) {
                        // methods[i].setInt(obj, (int) (100 * Math.random()));
                        // }
                    } else if (argClass == Float.class) {
                        // methods[i].setFloat(obj, (float) (100.0f *
                        // Math.random()));
                    } else if (argClass == Double.class) {
                        // methods[i].setDouble(obj, 100.0 *Math.random());
                    } else if (argClass == Boolean.class) {
                        // methods[i].setBoolean(obj,
                        // !methods[i].getBoolean(obj));
                    } else if (argClass == Long.class) {
                        // methods[i].setLong(obj, (long) (100L *
                        //
                        // Math.random()));
                    } else if (argClass == String.class) {
                        // String str = getRandomString();
                        //
                        // System.out.println(str);
                        //
                        // methods[i].set(obj, str);
                    } else if (argClass == Character.class) {
                        // methods[i].setChar(obj, (char)

                        // (Math.random() * 127));
                    } else {
                        if (argClass.getPackage().getName().startsWith("blue")) {
                            System.out.println(argClass);
                        }
                        // Object obj2 = methods[i].get(obj);
                        // if (obj2 != null) {
                        // ObjectRandomizer.randomizeFields(obj2);
                        // }
                        // }
                    }
                }
            } catch (IllegalArgumentException e) {
                // TODO Auto-generated catch block
                System.err.println("IllegalArgumentException: " + methods[i]);
                // e.printStackTrace();
                // } catch (IllegalAccessException e) {
                // // TODO Auto-generated catch block
                // System.err.println("IllegalAccessException: " + methods[i]);
                // e.printStackTrace();
            } catch (NullPointerException e) {
                System.err.println("NullPointerException: " + methods[i]);
            }
        }
    }

    public static void randomizeFields(Object obj) {
        Field[] fields = obj.getClass().getDeclaredFields();

        for (int i = 0; i < fields.length; i++) {
            int modifiers = fields[i].getModifiers();

            if ((modifiers & Modifier.STATIC) > 0
                    || (modifiers & Modifier.TRANSIENT) > 0
                    || (modifiers & Modifier.FINAL) > 0) {
                continue;
            }

            Class declaringClass = fields[i].getDeclaringClass();

            fields[i].setAccessible(true);

            // System.out.println(fields[i]);

            try {

                if (declaringClass.isArray()) {

                    System.err.println("Is Array: " + fields[i]);
                    int len = Array.getLength(obj);

                    for (int j = 0; j < len; j++) {

                        if (declaringClass == Integer.class) {
                            Array.setInt(obj, j, (int) (100 * Math.random()));
                        } else if (declaringClass == Float.class) {
                            Array.setFloat(obj, j, (float) (100.0f * Math
                                    .random()));
                        } else if (declaringClass == Double.class) {
                            Array.setDouble(obj, j, 100.0 * Math.random());
                        } else if (declaringClass == Boolean.class) {
                            Array
                                    .setBoolean(obj, j, !fields[i]
                                            .getBoolean(obj));
                        } else if (declaringClass == Long.class) {
                            Array
                                    .setLong(obj, j, (long) (100L * Math
                                            .random()));
                        } else if (declaringClass == String.class) {
                            String str = getRandomString();
                            System.out.println(str);

                            Array.set(obj, j, str);
                        } else if (declaringClass == Character.class) {
                            Array.setChar(obj, j, (char) (Math.random() * 127));
                        } else {
                            Object obj2 = Array.get(obj, j);

                            if (obj2 != null) {
                                ObjectRandomizer.randomizeFields(obj2);
                            }
                        }

                    }
                } else {

                    if (declaringClass == Integer.class) {
                        fields[i].setInt(obj, (int) (100 * Math.random()));
                    } else if (declaringClass == Float.class) {
                        fields[i].setFloat(obj,
                                (float) (100.0f * Math.random()));
                    } else if (declaringClass == Double.class) {
                        fields[i].setDouble(obj, 100.0 * Math.random());
                    } else if (declaringClass == Boolean.class) {
                        fields[i].setBoolean(obj, !fields[i].getBoolean(obj));
                    } else if (declaringClass == Long.class) {
                        fields[i].setLong(obj, (long) (100L * Math.random()));
                    } else if (declaringClass == String.class) {
                        String str = getRandomString();
                        System.out.println(str);

                        fields[i].set(obj, str);
                    } else if (declaringClass == Character.class) {
                        fields[i].setChar(obj, (char) (Math.random() * 127));
                    } else {
                        Object obj2 = fields[i].get(obj);

                        if (obj2 != null) {
                            ObjectRandomizer.randomizeFields(obj2);
                        }
                    }
                }
            } catch (IllegalArgumentException e) {
                // TODO Auto-generated catch block
                System.err.println("IllegalArgumentException: " + fields[i]);
                // e.printStackTrace();
            } catch (IllegalAccessException e) {
                // TODO Auto-generated catch block
                System.err.println("IllegalAccessException: " + fields[i]);
                // e.printStackTrace();
            } catch (NullPointerException e) {
                System.err.println("NullPointerException: " + fields[i]);
            }
        }
    }

    private static String getRandomString() {
        return new VMID().toString();
    }

    public static void main(String args[]) {
        Object test = new BlueData();

        // System.out.println(ToStringBuilder.reflectionToString(test));

        ObjectRandomizer.randomize(test);

        // System.out.println(ToStringBuilder.reflectionToString(test));
    }
}
