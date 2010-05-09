/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue;

/**
 *
 * @author Steven
 */
public class BluePluginFactory {
    private Class pluginType = null;
    private String propertyType = null;

    public BluePluginFactory() {}

    /**
     * @return the pluginType
     */
    public Class getPluginType() {
        return pluginType;
    }

    /**
     * @param pluginType the pluginType to set
     */
    public void setPluginType(Class pluginType) {
        this.pluginType = pluginType;
    }

    /**
     * @return the propertyType
     */
    public String getPropertyType() {
        return propertyType;
    }

    /**
     * @param propertyType the propertyType to set
     */
    public void setPropertyType(String propertyType) {
        this.propertyType = propertyType;
    }

    public BluePlugin createPlugin(Class pluginClass) {
        return createPlugin(pluginClass, null);
    }

    public BluePlugin createPlugin(Class pluginClass, Object property) {
        BluePlugin plugin = new BluePlugin(this.getPluginType(), pluginClass);

        if(getPropertyType() != null && property != null) {
            plugin.setProperty(getPropertyType(),property);
        }

        return plugin;
    }

    public void appendPlugin(Class pluginClass) {
        appendPlugin(pluginClass, null);
    }

    public void appendPlugin(Class pluginClass, Object property) {
        BluePluginManager.getInstance().addPlugin(
                createPlugin(pluginClass, property));
    }

}
