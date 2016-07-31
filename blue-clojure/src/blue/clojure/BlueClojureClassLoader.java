/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.clojure;

import clojure.lang.DynamicClassLoader;
import clojure.lang.Util;
import java.io.File;
import java.lang.ref.Reference;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.SoftReference;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BlueClojureClassLoader extends DynamicClassLoader {

    HashMap<Integer, Object[]> constantVals = new HashMap<>();
    ConcurrentHashMap<String, Reference<Class>> classCache =
            new ConcurrentHashMap<>();
    static final URL[] EMPTY_URLS = new URL[]{};
    static final ReferenceQueue rq = new ReferenceQueue();
    
    public BlueClojureClassLoader(File blueUserScriptDir, File projectScriptDir) {
        super(Thread.currentThread().getContextClassLoader());
        
        if (blueUserScriptDir != null && blueUserScriptDir.exists()) {
            try {
                URL url = blueUserScriptDir.toURI().toURL();
                System.out.println("URL: " + url);
                this.addURL(url);
            } catch (MalformedURLException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        if (projectScriptDir != null && projectScriptDir.exists()) {
            try {
                URL url = projectScriptDir.toURI().toURL();
                System.out.println("URL: " + url);
                this.addURL(url);
            } catch (MalformedURLException ex) {
                Exceptions.printStackTrace(ex);
            }
        }
    }
    
    @Override
    public Class defineClass(String name, byte[] bytes, Object srcForm) {
        Util.clearCache(rq, classCache);
        Class c = defineClass(name, bytes, 0, bytes.length);
        classCache.put(name, new SoftReference<>(c, rq));
        return c;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        Reference<Class> cr = classCache.get(name);
        if (cr != null) {
            Class c = cr.get();
            if (c != null) {
                return c;
            } else {
                classCache.remove(name, cr);
            }
        }
        return super.findClass(name);
    }

    @Override
    public void registerConstants(int id, Object[] val) {
        constantVals.put(id, val);
    }

    @Override
    public Object[] getConstants(int id) {
        return constantVals.get(id);
    }

    @Override
    public void addURL(URL url) {
        super.addURL(url);
    }
}
