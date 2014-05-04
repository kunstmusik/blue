/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.cecilia;

import blue.plugin.BluePlugin;
import blue.plugin.BluePluginFactory;
import blue.plugin.DefaultBluePluginProvider;
import blue.soundObject.CeciliaModule;
import blue.soundObject.SoundObject;

public class CeciliaPluginProvider extends DefaultBluePluginProvider {

    public CeciliaPluginProvider() {

        //SOUND OBJECT EDITORS
        BluePluginFactory factory = new BluePluginFactory(this);
        
        factory.setPluginType(SoundObject.class);
        factory.setPropertyType(BluePlugin.PROP_LIVE);

        factory.appendPlugin(CeciliaModule.class, false);
    }
}
