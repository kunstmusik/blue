/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.globals;

import blue.GlobalOrcSco;
import blue.event.SimpleDocumentListener;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.logging.Logger;
import javax.swing.event.DocumentEvent;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
final class GlobalScoreTopComponent extends TopComponent {

    private static GlobalScoreTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "GlobalScoreTopComponent";

    private GlobalOrcSco globalOrcSco = null;

    private GlobalScoreTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(GlobalScoreTopComponent.class, "CTL_GlobalScoreTopComponent"));
        setToolTipText(NbBundle.getMessage(GlobalScoreTopComponent.class, "HINT_GlobalScoreTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    globalOrcSco = null;
                    reinitialize();
                }
            }
        });

        reinitialize();

        blueEditorPane1.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                if (globalOrcSco != null) {
                    globalOrcSco.setGlobalSco(blueEditorPane1.getText());
                }
            }
        });
    }

    private void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        if (project == null) {
            blueEditorPane1.setText("");
            blueEditorPane1.setEditable(false);
        } else {
            GlobalOrcSco localGlobals = project.getData().getGlobalOrcSco();
            blueEditorPane1.setText(localGlobals.getGlobalSco());
            blueEditorPane1.setEditable(true);
            globalOrcSco = localGlobals;
        }
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        blueEditorPane1 = new blue.gui.BlueEditorPane();

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(blueEditorPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 586, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(blueEditorPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 452, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.gui.BlueEditorPane blueEditorPane1;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized GlobalScoreTopComponent getDefault() {
        if (instance == null) {
            instance = new GlobalScoreTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the GlobalScoreTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized GlobalScoreTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(GlobalScoreTopComponent.class.getName()).warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof GlobalScoreTopComponent) {
            return (GlobalScoreTopComponent) win;
        }
        Logger.getLogger(GlobalScoreTopComponent.class.getName()).warning(
                "There seem to be multiple components with the '" + PREFERRED_ID +
                "' ID. That is a potential source of errors and unexpected behavior.");
        return getDefault();
    }

    @Override
    public int getPersistenceType() {
        return TopComponent.PERSISTENCE_ALWAYS;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    /** replaces this in object stream */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return GlobalScoreTopComponent.getDefault();
        }
    }
}