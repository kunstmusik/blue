/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score.layers.soundObject.library.actions;

import blue.library.LibraryItem;
import blue.soundObject.SoundObject;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;

/**
 *
 * @author stevenyi
 */
public class AddFolderAction extends AbstractAction {

    private final LibraryItem<SoundObject> parent;

    public AddFolderAction(LibraryItem<SoundObject> parent) {
        super("Add Folder");
        this.parent = parent;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        var d = new NotifyDescriptor.InputLine("Folder Name:", "Enter the folder name");
        d.setInputText("New Folder");
        
        var res = DialogDisplayer.getDefault().notify(d);
        
        if(res == NotifyDescriptor.OK_OPTION) {
            var name = d.getInputText();
            if(name.isBlank()) {
                DialogDisplayer.getDefault().notify(new NotifyDescriptor.Message("Can not use empty name for folders.", NotifyDescriptor.ERROR_MESSAGE));
            } else {
                parent.getChildren().add(new LibraryItem<>(parent, name));
            }
            
        }
    }

}
