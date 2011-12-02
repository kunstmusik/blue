/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.cecilia;

import blue.BluePlugin;
import blue.BluePluginFactory;
import blue.soundObject.AudioFile;
import blue.soundObject.CeciliaModule;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.CeciliaModuleEditor;
import blue.soundObject.editor.SoundObjectEditor;
import blue.ui.core.soundObject.renderer.BarRenderer;
import blue.ui.core.soundObject.renderer.GenericRenderer;
import org.openide.modules.ModuleInstall;

public class Installer extends ModuleInstall {

    @Override
    public void restored() {
        initializeBluePlugins();
    }

    private void initializeBluePlugins() {

        //SOUND OBJECT EDITORS
//        BluePluginFactory factory = new BluePluginFactory();
//        factory.setPluginType(SoundObjectEditor.class);
//        factory.setPropertyType(BluePlugin.PROP_EDIT_CLASS);
//        factory.appendPlugin(CeciliaModuleEditor.class, CeciliaModule.class);
//        
//        factory.setPluginType(BarRenderer.class);
//
//        factory.appendPlugin(GenericRenderer.class, CeciliaModule.class);
//
//         factory.setPluginType(SoundObject.class);
//        factory.setPropertyType(BluePlugin.PROP_LIVE);
//
//        factory.appendPlugin(CeciliaModule.class, false);
    }

}
