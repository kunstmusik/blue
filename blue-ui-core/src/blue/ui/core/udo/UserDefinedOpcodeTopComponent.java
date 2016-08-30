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
import javax.swing.border.Border;
import javax.swing.border.LineBorder;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import org.netbeans.api.settings.ConvertAsProperties;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;

@ConvertAsProperties(
        dtd = "-//blue.ui.core.udo//UserDefinedOpcode//EN",
        autostore = false
)
@TopComponent.Description(
        preferredID = "UserDefinedOpcodeTopComponent",
        //iconBase="SET/PATH/TO/ICON/HERE", 
        persistenceType = TopComponent.PERSISTENCE_ALWAYS
)
@TopComponent.Registration(mode = "editor", openAtStartup = true,
        position = 300)
@ActionID(category = "Window", id = "blue.ui.core.udo.UserDefinedOpcodeTopComponent")
@ActionReferences({
    @ActionReference(path = "Menu/Window", position = 1300),
    @ActionReference(path = "Shortcuts",
            name = "D-3")
})
@TopComponent.OpenActionRegistration(
        displayName = "#CTL_UserDefinedOpcodeAction",
        preferredID = "UserDefinedOpcodeTopComponent"
)
@NbBundle.Messages({
    "CTL_UserDefinedOpcodeAction=User-Defined Opcodes",
    "CTL_UserDefinedOpcodeTopComponent=UDO",
    "HINT_UserDefinedOpcodeTopComponent=Editor for Project UDO's"
})
public final class UserDefinedOpcodeTopComponent extends TopComponent {

    private static UserDefinedOpcodeTopComponent instance;

    Border libraryBorder = new LineBorder(Color.GREEN);

    private boolean isChanging = false;

    private UserDefinedOpcodeTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(UserDefinedOpcodeTopComponent.class,
                "CTL_UserDefinedOpcodeTopComponent"));
        setToolTipText(NbBundle.getMessage(UserDefinedOpcodeTopComponent.class,
                "HINT_UserDefinedOpcodeTopComponent"));
//        setIcon(Utilities.loadImage(ICON_PATH, true));

          uDOLibraryPanel1.addSelectionListener((SelectionEvent e) -> {
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
        });

        opcodeListEditPanel1.addListSelectionListener((ListSelectionEvent e) -> {
            if (e.getValueIsAdjusting() || isChanging) {
                return;
            }
            
            UserDefinedOpcode[] udos = opcodeListEditPanel1.getSelectedUDOs();
            
            if(udos != null && udos.length == 1) {
                uDOEditor1.editUserDefinedOpcode(udos[0]);
                uDOEditor1.setBorder(null);
            } else {
                uDOEditor1.editUserDefinedOpcode(null);
                uDOEditor1.setBorder(null);
            }
            uDOLibraryPanel1.deselect();
        });


        BlueProjectManager.getInstance().addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                reinitialize();
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

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jSplitPane2, javax.swing.GroupLayout.DEFAULT_SIZE, 518, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(jSplitPane2, javax.swing.GroupLayout.DEFAULT_SIZE, 367, Short.MAX_VALUE)
        );
    }// </editor-fold>//GEN-END:initComponents
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JSplitPane jSplitPane1;
    private javax.swing.JSplitPane jSplitPane2;
    private blue.ui.core.udo.OpcodeListEditPanel opcodeListEditPanel1;
    private blue.ui.core.udo.UDOEditor uDOEditor1;
    private blue.ui.core.udo.UDOLibraryPanel uDOLibraryPanel1;
    // End of variables declaration//GEN-END:variables

    public static synchronized UserDefinedOpcodeTopComponent getDefault() {
        if (instance == null) {
            instance = new UserDefinedOpcodeTopComponent();
        }
        return instance;
    }

    @Override
    public void componentOpened() {
        // TODO add custom code on component opening
    }

    @Override
    public void componentClosed() {
        // TODO add custom code on component closing
    }

    void writeProperties(java.util.Properties p) {
        p.setProperty("version", "1.0");
    }

    void readProperties(java.util.Properties p) {
        String version = p.getProperty("version");
    }

    /** replaces this in object stream */
    @Override
    public Object writeReplace() {
        return new ResolvableHelper();
    }

    final static class ResolvableHelper implements Serializable {

        private static final long serialVersionUID = 1L;

        public Object readResolve() {
            return UserDefinedOpcodeTopComponent.getDefault();
        }
    }
}
