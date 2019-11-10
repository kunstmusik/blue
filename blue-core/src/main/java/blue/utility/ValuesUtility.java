/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import java.lang.reflect.Field;
import org.apache.commons.lang3.builder.ToStringBuilder;

/**
 * 
 * @author steven
 */
public class ValuesUtility {

    public static void checkNullString(Object obj) {
        checkNullString(obj, false);
    }

    public static void checkNullString(Object obj, boolean printMessages) {
        Class c = obj.getClass();

        Field[] fields = c.getDeclaredFields();

        for (int i = 0; i < fields.length; i++) {
            if (fields[i].getType() == String.class) {
                try {
                    if (fields[i].get(obj) == null) {
                        if (printMessages) {
                            System.err
                                    .println("ValuesUtility: Null String found in "
                                            + c.getName()
                                            + " field: "
                                            + fields[i].getName());
                        }
                        fields[i].set(obj, "");
                    }
                } catch (IllegalAccessException iae) {
                    iae.printStackTrace();
                }
            }
        }
    }

    public static void main(String[] args) {
        Object obj = new Object() {
            String val1 = "test";

            String val2 = "test2";

            String val3 = null;
        };

        System.out.println(ToStringBuilder.reflectionToString(obj));

        ValuesUtility.checkNullString(obj, true);

        System.out.println(ToStringBuilder.reflectionToString(obj));
    }

}
