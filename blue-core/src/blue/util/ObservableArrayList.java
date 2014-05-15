/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 *
 * @author stevenyi
 */
public class ObservableArrayList<T> extends ArrayList<T> implements ObservableList<T> {

    private transient List<ObservableListListener<T>> listeners = null;

    @Override
    public boolean addAll(int index, Collection<? extends T> c) {
        boolean retVal = super.addAll(index, c);
        if (retVal) {
            List<T> affected = new ArrayList<>(c);
            ObservableListEvent<T> event = new ObservableListEvent<>(this,
                    ObservableListEvent.DATA_ADDED, index,
                    index + c.size() - 1,
                    affected);
            super.clear();
            fireListChange(event);
        }
        return retVal;
    }

    @Override
    public boolean addAll(Collection<? extends T> c) {
        int index = size();
        
        boolean retVal = super.addAll(c); 

        if (retVal) {
            List<T> affected = new ArrayList<>(c);
            ObservableListEvent<T> event = new ObservableListEvent<>(this,
                    ObservableListEvent.DATA_ADDED, index,
                    index + c.size() - 1,
                    affected);
            super.clear();
            fireListChange(event);
        }
        return retVal;
    }

    @Override
    public void clear() {
        List<T> affected = new ArrayList<>(this);
        ObservableListEvent<T> event = new ObservableListEvent<>(this,
                ObservableListEvent.DATA_REMOVED, 0, affected.size() - 1,
                affected);
        super.clear();
        fireListChange(event);
    }

    @Override
    public boolean remove(Object o) {
        int index = indexOf(o);
        boolean retVal = super.remove(o);
        if (retVal) {
            List<T> affected = new ArrayList<>();
            affected.add((T) o);
            ObservableListEvent<T> event = new ObservableListEvent<>(this,
                    ObservableListEvent.DATA_REMOVED, index, index,
                    affected);
            fireListChange(event);
        }
        return retVal;
    }

    @Override
    public T remove(int index) {
        T retVal = super.remove(index);
        if (retVal != null) {
            List<T> affected = new ArrayList<>();
            affected.add(retVal);
            ObservableListEvent<T> event = new ObservableListEvent<>(this,
                    ObservableListEvent.DATA_REMOVED, index, index,
                    affected);
            fireListChange(event);
        }
        return retVal;
    }

    @Override
    public void add(int index, T element) {
        super.add(index, element);
        List<T> affected = new ArrayList<>();
        affected.add(element);
        ObservableListEvent<T> event = new ObservableListEvent<>(this,
                ObservableListEvent.DATA_ADDED, index, index,
                affected);
        fireListChange(event);
    }

    @Override
    public boolean add(T e) {
        int index = size();
        boolean retVal = super.add(e);
        List<T> affected = new ArrayList<>();
        affected.add(e);
        ObservableListEvent<T> event = new ObservableListEvent<>(this,
                ObservableListEvent.DATA_ADDED, index, index,
                affected);
        fireListChange(event);

        return retVal;
    }

    @Override
    public T set(int index, T element) {
        T retVal = super.set(index, element); 

        ObservableListEvent<T> event = new ObservableListEvent<>(this,
                ObservableListEvent.DATA_CHANGED, index, index,
                null);
        fireListChange(event);
        
        return retVal;
    }

    

    public void addListener(ObservableListListener<T> listener) {
        if (listeners == null) {
            listeners = new ArrayList<>();
        }
        listeners.add(listener);
    }

    public void removeListener(ObservableListListener<T> listener) {
        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    protected void fireListChange(ObservableListEvent<T> event) {
        if (listeners != null) {
            for (ObservableListListener<T> listener : listeners) {
                listener.listChanged(event);
            }
        }
    }


}
