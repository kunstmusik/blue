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

package blue;

import blue.utility.XMLUtilities;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;
import java.awt.Window;
import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Iterator;

/**
 * 
 * @author Steven Yi
 */
public class WindowSettingManager {
    private static WindowSettingManager manager = null;

    private static final String SETTINGS_FILE_NAME = "windowSettings.xml";

    private HashMap windows = new HashMap();

    private HashMap settings = new HashMap();

    private WindowSettingManager() {
        load();
    }

    public static WindowSettingManager getInstance() {
        if (manager == null) {
            manager = new WindowSettingManager();
        }
        return manager;
    }

    private void load() {
        String userDir = BlueSystem.getUserConfigurationDirectory();

        String settingsFile = userDir + File.separator + SETTINGS_FILE_NAME;

        File f = new File(settingsFile);

        if (!f.exists()) {
            return;
        }

        try {
            Document doc = new Document(f);
            Element root = doc.getRoot();

            Elements nodes = root.getElements();

            while (nodes.hasMoreElements()) {
                Element node = nodes.next();
                String key = node.getAttributeValue("windowName");
                settings.put(key, node);
            }

        } catch (ParseException e) {
            e.printStackTrace();
        }
    }

    public void save() {

        updateSettings();

        Document doc = new Document();

        Element root = doc.setRoot("windowSettings");

        for (Iterator it = settings.values().iterator(); it.hasNext();) {
            Element node = (Element) it.next();
            root.addElement(node);
        }

        String userDir = BlueSystem.getUserConfigurationDirectory();

        String settingsFile = userDir + File.separator + SETTINGS_FILE_NAME;

        try {
            try (FileOutputStream out = new FileOutputStream(settingsFile)) {
                doc.write(out);
                out.flush();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * This method updates the Settings map with values from the currently
     * registered windows. Existing settings for windows still remain in the
     * map, which is necessary in case of windows which are lazily loaded and
     * have had previous states saved, so that their settings are not lost.
     */
    private void updateSettings() {
        for (Iterator it = windows.keySet().iterator(); it.hasNext();) {
            String key = (String) it.next();
            Window w = (Window) windows.get(key);

            Element node;

            if (w instanceof WindowSettingsSavable) {
                WindowSettingsSavable savable = (WindowSettingsSavable) w;
                node = savable.saveWindowSettings();
            } else {
                node = getBasicSettings(w);
            }

            node.setAttribute("windowName", key);

            settings.put(key, node);
        }
    }

    public void registerWindow(String windowName, Window window) {

        if (windows.containsKey(windowName)) {
            System.err.println("Window already registered with name: "
                    + windowName);
        }

        if (!(window instanceof WindowSettingsSavable)) {
            System.err.println("Window with name " + windowName + " is not an "
                    + "instance of WindowsSettingSavable");
        }

        windows.put(windowName, window);

        if (settings.containsKey(windowName)) {
            if (window instanceof WindowSettingsSavable) {
                WindowSettingsSavable savable = (WindowSettingsSavable) window;
                savable.loadWindowSettings((Element) settings.get(windowName));
            }
        }

    }

    public static Element getBasicSettings(Window window) {
        Element root = new Element("window");

        root.addElement(XMLUtilities.writeInt("x", window.getX()));
        root.addElement(XMLUtilities.writeInt("y", window.getY()));
        root.addElement(XMLUtilities.writeInt("width", window.getWidth()));
        root.addElement(XMLUtilities.writeInt("height", window.getHeight()));

        return root;
    }

    public static void setBasicSettings(Element data, Window window) {
        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "x":
                    int x = Integer.parseInt(node.getTextString());
                    window.setLocation(x, window.getY());
                    break;
                case "y":
                    int y = Integer.parseInt(node.getTextString());
                    window.setLocation(window.getX(), y);
                    break;
                case "width":
                    int w = Integer.parseInt(node.getTextString());
                    window.setSize(w, window.getHeight());
                    break;
                case "height":
                    int h = Integer.parseInt(node.getTextString());
                    window.setSize(window.getWidth(), h);
                    break;
            }
        }
    }
}
