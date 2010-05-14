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

package blue.ui.core.project;

import blue.BlueData;
import blue.ProjectProperties;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.logging.Logger;
import org.openide.util.NbBundle;
import org.openide.windows.TopComponent;
import org.openide.windows.WindowManager;
//import org.openide.util.ImageUtilities;
import org.netbeans.api.settings.ConvertAsProperties;

/**
 * Top component which displays something.
 */
@ConvertAsProperties(
    dtd="-//blue.ui.core.project//ProjectProperties//EN",
    autostore=false
)
public final class ProjectPropertiesTopComponent extends TopComponent {

    private static ProjectPropertiesTopComponent instance;
    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";

    private static final String PREFERRED_ID = "ProjectPropertiesTopComponent";

    public ProjectPropertiesTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(ProjectPropertiesTopComponent.class, "CTL_ProjectPropertiesTopComponent"));
        setToolTipText(NbBundle.getMessage(ProjectPropertiesTopComponent.class, "HINT_ProjectPropertiesTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {
            public void propertyChange(PropertyChangeEvent evt) {
                if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
                    reinitialize();
                }
            }
        });

        reinitialize();
    }

    public void reinitialize() {

        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        ProjectProperties projectProperties = null;

        if (project != null) {
            BlueData data = project.getData();

            if(data != null) {
                projectProperties = data.getProjectProperties();
            }

        }

        if (projectProperties == null) {
            this.projectInformationPanel1.setProjectProperties(null);
            this.realtimeRenderSettingsPanel1.setProjectProperties(null);
            this.diskRenderSettingsPanel1.setProjectProperties(null);
            this.cSLADSPASettingsPanel1.setCsladspaSettings(null);
        } else {
            this.projectInformationPanel1.setProjectProperties(projectProperties);
            this.realtimeRenderSettingsPanel1.setProjectProperties(projectProperties);
            this.diskRenderSettingsPanel1.setProjectProperties(projectProperties);
            this.cSLADSPASettingsPanel1.setCsladspaSettings(projectProperties.csladspaSettings);
        }

    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jTabbedPane1 = new javax.swing.JTabbedPane();
        projectInformationPanel1 = new blue.ui.core.project.ProjectInformationPanel();
        realtimeRenderSettingsPanel1 = new blue.ui.core.project.RealtimeRenderSettingsPanel();
        diskRenderSettingsPanel1 = new blue.ui.core.project.DiskRenderSettingsPanel();
        cSLADSPASettingsPanel1 = new blue.ui.core.project.CSLADSPASettingsPanel();

        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(ProjectPropertiesTopComponent.class, "ProjectPropertiesTopComponent.projectInformationPanel1.TabConstraints.tabTitle"), projectInformationPanel1); // NOI18N
        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(ProjectPropertiesTopComponent.class, "ProjectPropertiesTopComponent.realtimeRenderSettingsPanel1.TabConstraints.tabTitle"), realtimeRenderSettingsPanel1); // NOI18N
        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(ProjectPropertiesTopComponent.class, "ProjectPropertiesTopComponent.diskRenderSettingsPanel1.TabConstraints.tabTitle"), diskRenderSettingsPanel1); // NOI18N
        jTabbedPane1.addTab(org.openide.util.NbBundle.getMessage(ProjectPropertiesTopComponent.class, "ProjectPropertiesTopComponent.cSLADSPASettingsPanel1.TabConstraints.tabTitle"), cSLADSPASettingsPanel1); // NOI18N

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 412, Short.MAX_VALUE)
            .add(jTabbedPane1, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 412, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(0, 352, Short.MAX_VALUE)
            .add(jTabbedPane1)
        );
    }// </editor-fold>//GEN-END:initComponents

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.ui.core.project.CSLADSPASettingsPanel cSLADSPASettingsPanel1;
    private blue.ui.core.project.DiskRenderSettingsPanel diskRenderSettingsPanel1;
    private javax.swing.JTabbedPane jTabbedPane1;
    private blue.ui.core.project.ProjectInformationPanel projectInformationPanel1;
    private blue.ui.core.project.RealtimeRenderSettingsPanel realtimeRenderSettingsPanel1;
    // End of variables declaration//GEN-END:variables
    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized ProjectPropertiesTopComponent getDefault() {
        if (instance == null) {
            instance = new ProjectPropertiesTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the ProjectPropertiesTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized ProjectPropertiesTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(
                PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(ProjectPropertiesTopComponent.class.getName()).
                    warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof ProjectPropertiesTopComponent) {
            return (ProjectPropertiesTopComponent) win;
        }
        Logger.getLogger(ProjectPropertiesTopComponent.class.getName()).warning(
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

    void writeProperties(java.util.Properties p) {
        // better to version settings since initial version as advocated at
        // http://wiki.apidesign.org/wiki/PropertyFiles
        p.setProperty("version", "1.0");
        // TODO store your settings
    }

    Object readProperties(java.util.Properties p) {
        ProjectPropertiesTopComponent singleton = ProjectPropertiesTopComponent.
                getDefault();
        singleton.readPropertiesImpl(p);
        return singleton;
    }

    private void readPropertiesImpl(java.util.Properties p) {
        String version = p.getProperty("version");
        // TODO read your settings according to their version
    }

    @Override
    protected String preferredID() {
        return PREFERRED_ID;
    }
}