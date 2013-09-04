/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.ui.core.score.noteProcessorChain;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

class PropertyEditProxy {

    Object obj;

    Method getMethod;

    Method setMethod;

    String propertyName;

    public PropertyEditProxy(Object obj, String propertyName, Method getMethod,
            Method setMethod) {
        this.obj = obj;
        this.propertyName = propertyName;
        this.getMethod = getMethod;
        this.setMethod = setMethod;
    }

    public String getPropertyName() {
        return propertyName;
    }

    public Object getValue() {
        Object o = null;
        try {
            o = getMethod.invoke(obj);
        } catch (IllegalAccessException | IllegalArgumentException | InvocationTargetException e) {
            e.printStackTrace();
        }
        return o;
    }

    public void setValue(Object val) throws Exception {
        Object[] args = new Object[1];
        args[0] = val.toString();
        // Object o = setMethod.invoke(obj, args);
        setMethod.invoke(obj, args);
    }

    @Override
    public String toString() {
        return getValue().toString();
    }
}