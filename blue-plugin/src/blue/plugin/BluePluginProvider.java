/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plugin;

import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
public interface BluePluginProvider {
    public ArrayList<BluePlugin> getPlugins(Class pluginClass);
    public ArrayList<Class> getPluginClasses(Class pluginClass);
}
