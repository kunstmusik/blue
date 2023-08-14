/*
 * blue - object composition environment for csound
 * Copyright (C) 2023
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
package blue.utilities;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 *
 * @author stevenyi
 */
public class MemoizedFunction<T, R> {

    Map<T, R> cache = new HashMap<>();
    
    private final Function<T, R> computeFunction;

    public MemoizedFunction(Function<T, R> computeFunction) {
        this.computeFunction = computeFunction;
    }

    public R invoke(T input) {
        
        if(cache.containsKey(input)) {
            return cache.get(input);
        }
        
        var v = computeFunction.apply(input);
        cache.put(input, v);
        return v;
    }

}
