/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score.layers.soundObject;

import blue.event.SelectionEvent;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.ScoreObjectEditor;
import blue.ui.core.score.layers.SoundObjectProvider;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import javax.swing.JPanel;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.util.NbBundle;
import org.openide.util.Utilities;
import org.openide.windows.TopComponent;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(
        dtd = "-//blue.ui.core.score.layers.soundObject//ScoreObjectEditorTopComponent//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "ScoreObjectEditorTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "output", openAtStartup = false,
        position = 100)
@ActionID(category = "Window", id = "blue.ui.core.score.layers.soundObject.ScoreObjectEditorTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 100),
    @ActionReference(path = "Shortcuts", 
            name = "DS-E")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_ScoreObjectEditorAction",
        preferredID = "ScoreObjectEditorTopComponent"
)
@NbBundle.Messages({
    "CTL_ScoreObjectEditorAction=ScoreObject Editor",
    "CTL_ScoreObjectEditorTopComponent=ScoreObject Editor",
    "HINT_ScoreObjectEditorTopComponent=This is a ScoreObjectEditor window"
})
final public class ScoreObjectEditorTopComponent extends TopComponent
        implements LookupListener {

    private static ScoreObjectEditorTopComponent instance;
    /**
     * path to the icon used by the component and its open action
     */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";

    JPanel editPanel = new JPanel();

    CardLayout cardLayout = new CardLayout();

    SoundObject currentSoundObject;

//    HashMap<Class, Class> sObjEditorMap = new HashMap<>();
//    HashMap<Class, ScoreObjectEditor> editors = new HashMap<>();
    List<ScoreObjectEditor> editors = new ArrayList<>();

    JPanel emptyPanel = new JPanel();

    Lookup.Result<SoundObject> result = null;

    private ScoreObjectEditorTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(ScoreObjectEditorTopComponent.class,
                "CTL_ScoreObjectEditorTopComponent"));
        setToolTipText(NbBundle.getMessage(ScoreObjectEditorTopComponent.class,
                "HINT_ScoreObjectEditorTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));
        emptyPanel.setMinimumSize(new Dimension(0, 0));
        this.setLayout(new BorderLayout());
        editPanel.setLayout(cardLayout);
        this.add(editPanel, BorderLayout.CENTER);
        editPanel.add(emptyPanel, "none");

        FileObject sObjEditorFiles[] = FileUtil.getConfigFile(
                "blue/score/objectEditors").getChildren();

        for (FileObject fObj : sObjEditorFiles) {
            ScoreObjectEditor sObjEditor = FileUtil.getConfigObject(
                    fObj.getPath(),
                    ScoreObjectEditor.class);
            editors.add(sObjEditor);
            editPanel.add(sObjEditor.getClass().getName(), sObjEditor);
        }

        setEditingLibraryObject(null);
        setActivatedNodes(null);
    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        setLayout(new java.awt.CardLayout());
    }// </editor-fold>//GEN-END:initComponents


    // Variables declaration - do not modify//GEN-BEGIN:variables
    // End of variables declaration//GEN-END:variables

    @Override
    public void componentOpened() {
        result = Utilities.actionsGlobalContext().lookupResult(SoundObject.class);
        result.addLookupListener(this);
        resultChanged(null);
    }

    @Override
    public void componentClosed() {
        result.removeLookupListener(this);
    }

    void writeProperties(java.util.Properties p) {
        // better to version settings since initial version as advocated at
        // http://wiki.apidesign.org/wiki/PropertyFiles
        p.setProperty("version", "1.0");
        // TODO store your settings
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
        // TODO read your settings according to their version
    }

    @Override
    public void resultChanged(LookupEvent ev) {

        if (!(TopComponent.getRegistry().getActivated() instanceof SoundObjectProvider)) {
            return;
        }

        Collection<? extends SoundObject> soundObjects = result.allInstances();
        if (soundObjects.size() == 1) {
            editSoundObject(soundObjects.iterator().next());
            //FIXME - setEditingLibraryObject(...)
        } else {
            editSoundObject(null);
        }
    }

    public void setEditingLibraryObject(Object objectType) {
        String name = NbBundle.getMessage(ScoreObjectEditorTopComponent.class,
                "CTL_ScoreObjectEditorTopComponent");

        if (objectType == SelectionEvent.SELECTION_LIBRARY) {
            name += " - Library";
        } else if (objectType == SelectionEvent.SELECTION_BLUE_LIVE) {
            name += " - blue Live";
        }

        setName(name);
//        this.libraryEditLabel.setVisible(isLibaryObject);
    }

    public void editSoundObject(SoundObject sObj) {
        if (currentSoundObject == sObj) {
            return;
        }

        currentSoundObject = sObj;

        cardLayout.show(editPanel, "none");
        if (sObj == null) {
            // JOptionPane.showMessageDialog(null, "yo");
            return;
        }

        SoundObject sObjToEdit = sObj;

        if (sObj instanceof Instance) {
            sObjToEdit = ((Instance) sObj).getSoundObject();
            this.setEditingLibraryObject(SelectionEvent.SELECTION_LIBRARY);
        }

        boolean found = false;
        for (ScoreObjectEditor sObjEditor : editors) {
            if (sObjEditor.accepts(sObjToEdit)) {
                sObjEditor.editScoreObject(sObjToEdit);
                cardLayout.show(editPanel, sObjEditor.getClass().getName());
                found = true;
                break;
            }
        }

        if (!found) {
            DialogDisplayer.getDefault().notify(new NotifyDescriptor(
                    "Could not find editor for SoundObject of type: " + sObjToEdit.getClass().getCanonicalName(),
                    "Error",
                    NotifyDescriptor.DEFAULT_OPTION,
                    NotifyDescriptor.ERROR_MESSAGE, null, null));
            return;
        }

//        Logger.getLogger(ScoreObjectEditorTopComponent.class.getName()).fine("SoundObject Selected: " + className);;
    }
}
