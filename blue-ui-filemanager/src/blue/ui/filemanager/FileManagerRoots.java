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
package blue.ui.filemanager;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author stevenyi
 */
public class FileManagerRoots {

    List<File> staticRoots = new ArrayList<>();
    List<File> customRoots = new ArrayList<>();

    transient List<ChangeListener> listeners = new ArrayList<>();

    public FileManagerRoots() {
        staticRoots.addAll(Arrays.asList(File.listRoots()));
        staticRoots.add(new File(System.getProperty("user.home")));

        loadCustomRoots();
    }

    public List<File> getRoots() {
        List<File> retVal = new ArrayList<File>();
        retVal.addAll(staticRoots);
        retVal.addAll(customRoots);
        return retVal;
    }

    public boolean staticRootsContains(File f) {
        return staticRoots.contains(f);
    }

    public boolean customRootsContains(File file) {
        return customRoots.contains(file);
    }
    
    public boolean contains(File f) {
        return staticRoots.contains(f) || customRoots.contains(f);
    }

    public void addRoot(File f) {
        if (!f.isDirectory() || contains(f)) {
            return;
        }

        customRoots.add(f);
        fireChange(new ChangeEvent(this));
        saveCustomRoots();
    }

    public void removeRoot(File f) {
        if(customRoots.contains(f)) {
            customRoots.remove(f);
            fireChange(new ChangeEvent(this));
            saveCustomRoots();
        }
    }

    /* Listener code */
    public void addChangeListener(ChangeListener cl) {
        listeners.add(cl);
    }

    public void removeChangeListener(ChangeListener cl) {
        listeners.remove(cl);
    }

    public void fireChange(ChangeEvent ce) {
        for (ChangeListener listener : listeners) {
            listener.stateChanged(ce);
        }
    }

    private void loadCustomRoots() {
        Preferences p = NbPreferences.forModule(FileManagerRoots.class);

        int i = 0;

        while (true) {
            String root = p.get("customRoot" + i, null);
            if (root == null) {
                break;
            }
            File f = new File(root);
            if (f.exists() && f.isDirectory()) {
                customRoots.add(f);
            }
            i++;
        }
    }

    private void saveCustomRoots() {
        Preferences p = NbPreferences.forModule(FileManagerRoots.class);
        try {
            p.clear();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }

        int i = 0;
        for (File f : customRoots) {
            p.put("customRoot" + i, f.getAbsolutePath());
            i++;
        }

        try {
            p.flush();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

}
