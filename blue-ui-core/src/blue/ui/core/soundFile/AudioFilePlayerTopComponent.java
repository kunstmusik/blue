/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
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

package blue.ui.core.soundFile;

import java.io.File;
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
    dtd="-//blue.ui.core.soundFile//AudioFilePlayer//EN",
    autostore=false
)
public final class AudioFilePlayerTopComponent extends TopComponent {

    private static AudioFilePlayerTopComponent instance;
    /** path to the icon used by the component and its open action */
//    static final String ICON_PATH = "SET/PATH/TO/ICON/HERE";

    private static final String PREFERRED_ID = "AudioFilePlayerTopComponent";

    public AudioFilePlayerTopComponent() {
        initComponents();
        setName(NbBundle.getMessage(AudioFilePlayerTopComponent.class, "CTL_AudioFilePlayerTopComponent"));
        setToolTipText(NbBundle.getMessage(AudioFilePlayerTopComponent.class, "HINT_AudioFilePlayerTopComponent"));
//        setIcon(ImageUtilities.loadImage(ICON_PATH, true));

    }

    public void setAudioFile(File audioFile) {
        audioFilePlayer1.setSoundFile(audioFile);
        audioFilePlayer1.forcePlay();
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        audioFilePlayer1 = new blue.ui.core.soundFile.AudioFilePlayer();
        soundFileInformationPanel1 = new blue.ui.core.soundFile.SoundFileInformationPanel();

        audioFilePlayer1.addPropertyChangeListener(new java.beans.PropertyChangeListener() {
            public void propertyChange(java.beans.PropertyChangeEvent evt) {
                audioFilePlayer1PropertyChange(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addComponent(audioFilePlayer1, javax.swing.GroupLayout.DEFAULT_SIZE, 420, Short.MAX_VALUE)
            .addGroup(layout.createSequentialGroup()
                .addGap(10, 10, 10)
                .addComponent(soundFileInformationPanel1, javax.swing.GroupLayout.DEFAULT_SIZE, 400, Short.MAX_VALUE)
                .addGap(10, 10, 10))
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addComponent(audioFilePlayer1, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(soundFileInformationPanel1, javax.swing.GroupLayout.PREFERRED_SIZE, 246, Short.MAX_VALUE)
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void audioFilePlayer1PropertyChange(java.beans.PropertyChangeEvent evt) {//GEN-FIRST:event_audioFilePlayer1PropertyChange
        if("soundFile".equals(evt.getPropertyName())) {
            soundFileInformationPanel1.setSoundFile((File)evt.getNewValue());
        }
    }//GEN-LAST:event_audioFilePlayer1PropertyChange

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private blue.ui.core.soundFile.AudioFilePlayer audioFilePlayer1;
    private blue.ui.core.soundFile.SoundFileInformationPanel soundFileInformationPanel1;
    // End of variables declaration//GEN-END:variables
    /**
     * Gets default instance. Do not use directly: reserved for *.settings files only,
     * i.e. deserialization routines; otherwise you could get a non-deserialized instance.
     * To obtain the singleton instance, use {@link #findInstance}.
     */
    public static synchronized AudioFilePlayerTopComponent getDefault() {
        if (instance == null) {
            instance = new AudioFilePlayerTopComponent();
        }
        return instance;
    }

    /**
     * Obtain the AudioFilePlayerTopComponent instance. Never call {@link #getDefault} directly!
     */
    public static synchronized AudioFilePlayerTopComponent findInstance() {
        TopComponent win = WindowManager.getDefault().findTopComponent(
                PREFERRED_ID);
        if (win == null) {
            Logger.getLogger(AudioFilePlayerTopComponent.class.getName()).
                    warning(
                    "Cannot find " + PREFERRED_ID + " component. It will not be located properly in the window system.");
            return getDefault();
        }
        if (win instanceof AudioFilePlayerTopComponent) {
            return (AudioFilePlayerTopComponent) win;
        }
        Logger.getLogger(AudioFilePlayerTopComponent.class.getName()).warning(
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
        AudioFilePlayerTopComponent singleton = AudioFilePlayerTopComponent.
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
