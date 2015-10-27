/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import blue.plaf.SwingPropertiesTest;
import javafx.application.Platform;
import org.openide.modules.ModuleInstall;

public class Installer extends ModuleInstall {

    @Override
    public void restored() {
        Platform.setImplicitExit(true);
        new Thread(() -> BlueJFXControlsApplication.main(null)).start();
    }

}
