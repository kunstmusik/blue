/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.udo;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import java.awt.Color;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.logging.Logger;
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.Utilities;

/**
 * Top component which displays something.
 */
final class UserDefinedOpcodeTopComponent extends TopComponent {

    private static UserDefinedOpcodeTopComponent instance;

    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";
    private static final String PREFERRED_ID = "UserDefinedOpcodeTopComponent";

    Border libraryBorder = new LineBorder(Color.GREEN);

    private boolean isChanging = false;

    private UserDefinedOpcodeTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(UserDefinedOpcodeTopComponent.class,
                "CTL_UserDefinedOpcodeTopComponent"));
        setToolTipText(NbBundle.getMessage(UserDefinedOpcodeTopComponent.class,
                "HINT_UserDefinedOpcodeTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

          uDOLibraryPanel1.addSelectionListener(new SelectionListener() {

            public void selectionPerformed(SelectionEvent e) {
                Object obj = e.getSelectedItem();

                isChanging = true;

                if (obj instanceof UserDefinedOpcode) {
                    uDOEditor1.editUserDefinedOpcode((UserDefinedOpcode) obj);
                    uDOEditor1.setBorder(libraryBorder);
                } else {
                    uDOEditor1.editUserDefinedOpcode(null);
                    uDOEditor1.setBorder(null);
                }

                opcodeListEditPanel1.deselect();
                isChanging = false;
            }

        });

        opcodeListEditPanel1.addListSelectionListener(new ListSelectionListener() {

            public void valueChanged(ListSelectionEvent e) {

                if (e.getValueIsAdjusting() || isChanging) {
                    return;
                }

                UserDefinedOpcode udo = opcodeListEditPanel1.getSelectedUDO();

                uDOEditor1.editUserDefinedOpcode(udo);
                uDOEditor1.setBorder(null);

                uDOLibraryPanel1.deselect();

            }
        });


        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });


        reinitialize();
    }

    private void reinitialize() {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        if (project == null) {
            opcodeListEditPanel1.setOpcodeList(null);
        } else {
            OpcodeList opcodeList = project.getData().getOpcodeList();
            opcodeListEditPanel1.setOpcodeList(opcodeList);
        }
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jSplitPane2 = new javax.swing.JSplitPane();
        jSplitPane1 = new javax.swing.JSplitPane();
        uDOEditor1 = new blue.ui.core.udo.UDOEditor();
        opcodeListEditPanel1 = new blue.ui.core.udo.OpcodeListEditPanel();
        uDOLibraryPanel1 = new blue.ui.core.udo.UDOLibraryPanel();

        jSplitPane2.setDividerLocation(200);
        jSplitPane2.setMinimumSize(new java.awt.Dimension(0, 0));

        jSplitPane1.setDividerLocation(200);
        jSplitPane1.setOrientation(javax.swing.JSplitPane.VERTICAL_SPLIT);
        jSplitPane1.setMinimumSize(new java.awt.Dimension(0, 0));
        jSplitPane1.setRightComponent(uDOEditor1);
        jSplitPane1.setTopComponent(opcodeListEditPanel1);

        jSplitPane2.setRightComponent(jSplitPane1);
        jSplitPane2.setLeftComponent(uDOLibraryPanel1);

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jSplitPane2, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 518, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(jSplitPane2, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 367, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JSplitPane jSplitPane1;
    private javax.swing.JSplitPane jSplitPane2;
    private blue.ui.core.udo.OpcodeListEditPanel opcodeListEditPanel1;
    private blue.ui.core.udo.UDOEditor uDOEditor1;
    private blue.ui.core.udo.UDOLibraryPanel uDOLibraryPanel1;
    // End of variables declaration//GEN-END:variables

    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized UserDefinedOpcodeTopComponent getDefault() {
        if (instance == null) {
            instance = new UserDefinedOpcodeTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the UserDefinedOpcodeTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized UserDefinedOpcodeTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(
                PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(UserDefinedOpcodeTopComponent.class.getName()).
                    warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof UserDefinedOpcodeTopComponent) {
            return (UserDefinedOpcodeTopComponent) win;
        }
        Logger.getLogger(UserDefinedOpcodeTopComponent.class.getName()).warning(
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
            return UserDefinedOpcodeTopComponent.getDefault();
        }
    }
}