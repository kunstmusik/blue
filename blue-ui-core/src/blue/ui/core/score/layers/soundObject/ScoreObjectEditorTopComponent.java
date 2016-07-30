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
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.soundObject.Instance;
import blue.soundObject.editor.ScoreObjectEditor;
import blue.ui.core.score.layers.SoundObjectProvider;
import blue.ui.nbutilities.lazyplugin.ClassAssociationProcessor;
import blue.ui.nbutilities.lazyplugin.LazyPlugin;
import blue.ui.nbutilities.lazyplugin.LazyPluginFactory;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.swing.JPanel;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
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

    ScoreObject currentSoundObject;

    Map<Class, LazyPlugin<ScoreObjectEditor>> sObjEditorMap = new HashMap<>();
    Map<Class, ScoreObjectEditor> editors = new HashMap<>();

    JPanel emptyPanel = new JPanel();

    Lookup.Result<ScoreObject> result = null;

    PropertyChangeListener projectListener;

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


        List<LazyPlugin<ScoreObjectEditor>> plugins = LazyPluginFactory.
                loadPlugins("blue/score/objectEditors", 
                        ScoreObjectEditor.class, 
                        new ClassAssociationProcessor("scoreObjectType"));
        
        for (LazyPlugin<ScoreObjectEditor> plugin : plugins) {
                sObjEditorMap.put(
                        (Class)plugin.getMetaData("association"), plugin);
        }

        setEditingLibraryObject(null);
        setActivatedNodes(null);

        projectListener = new PropertyChangeListener() {

            @Override
            public void propertyChange(PropertyChangeEvent evt) {
                editScoreObject(null);

            }
        };
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
        BlueProjectManager.getInstance().addPropertyChangeListener(
                projectListener);
        result = Utilities.actionsGlobalContext().lookupResult(ScoreObject.class);
        result.addLookupListener(this);
        resultChanged(null);
    }

    @Override
    public void componentClosed() {
        BlueProjectManager.getInstance().removePropertyChangeListener(
                projectListener);
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

        Collection<? extends ScoreObject> scoreObjects = result.allInstances();
        if (scoreObjects.size() == 1) {
            editScoreObject(scoreObjects.iterator().next());
            //FIXME - setEditingLibraryObject(...)
        } else {
            editScoreObject(null);
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

    public void editScoreObject(ScoreObject sObj) {
        if (currentSoundObject == sObj) {
            return;
        }

        currentSoundObject = sObj;

        cardLayout.show(editPanel, "none");
        if (sObj == null) {
            // JOptionPane.showMessageDialog(null, "yo");
            return;
        }

        ScoreObject sObjToEdit = sObj;

        if (sObj instanceof Instance) {
            sObjToEdit = ((Instance) sObj).getSoundObject();
            this.setEditingLibraryObject(SelectionEvent.SELECTION_LIBRARY);
        }

        ScoreObjectEditor editor = editors.get(sObjToEdit.getClass());
        if (editor == null) {
            for (Class c : sObjEditorMap.keySet()) {
                if (c.isAssignableFrom(sObjToEdit.getClass())) {
                    LazyPlugin<ScoreObjectEditor> plugin = sObjEditorMap.get(c);
                    editor = plugin.getInstance();
                    editors.put(sObjToEdit.getClass(), editor);
                    editPanel.add(editor, editor.getClass().getName());
                    break;
                }
            }
        }

        if (editor == null) {
            DialogDisplayer.getDefault().notify(new NotifyDescriptor(
                    "Could not find editor for SoundObject of type: " + sObjToEdit.getClass().getCanonicalName(),
                    "Error",
                    NotifyDescriptor.DEFAULT_OPTION,
                    NotifyDescriptor.ERROR_MESSAGE, null, null));
            return;
        }

        editor.editScoreObject(sObjToEdit);
        cardLayout.show(editPanel, editor.getClass().getName());

//        Logger.getLogger(ScoreObjectEditorTopComponent.class.getName()).fine("SoundObject Selected: " + className);;
    }
}
