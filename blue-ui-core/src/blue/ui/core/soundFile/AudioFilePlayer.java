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

/*
 * AudioFilePlayer.java
 *
 * Created on Sep 30, 2009, 8:59:50 PM
 */
package blue.ui.core.soundFile;

import blue.BlueSystem;
import blue.ui.utilities.FileChooserManager;
import blue.utility.GenericFileFilter;
import java.io.File;
import java.io.FileNotFoundException;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.Mixer;
import javax.sound.sampled.SourceDataLine;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.JProgressBar;

/**
 *
 * @author syi
 */
public class AudioFilePlayer extends javax.swing.JPanel {

    File soundFile = null;

    SoundFilePlayerRunnable audioFilePlayer = null;

    float timeDivisor = -1.0f;

    String duration = "00:00:00";

    String currentTime = "00:00:00";

    static {
        FileChooserManager.getDefault().addFilter(AudioFilePlayer.class,
                new GenericFileFilter(new String[]{"aiff", "aif"},
                "AIFF file (.aif, aiff)"));
        FileChooserManager.getDefault().addFilter(AudioFilePlayer.class,
                new GenericFileFilter("wav", "WAV file (.wav)"));
    }

    /** Creates new form AudioFilePlayer */
    public AudioFilePlayer() {
        initComponents();
        setSoundFile(null);
    }

    public void setSoundFile(File soundFile) {
        Object oldSoundFile = this.soundFile;
        this.soundFile = soundFile;

        boolean isAudioFile = true;

        AudioFileFormat aFormat = null;
        AudioFormat format = null;

        try {
            aFormat = AudioSystem.getAudioFileFormat(soundFile);
            format = aFormat.getFormat();
        } catch (Exception e) {
            isAudioFile = false;

            timeDivisor = -1;

        }

        stop();

        if (this.soundFile == null || !isAudioFile) {
            this.fileNameText.setText("");
            this.playStopButton.setEnabled(false);
            playStopButton.setText(BlueSystem.getString(
                    "soundfile.player.noFileSelected"));
        } else {
            this.fileNameText.setText(soundFile.getAbsolutePath());
            this.playStopButton.setEnabled(true);
            playStopButton.setText(BlueSystem.getString(
                    "soundfile.player.playStop"));

            timeDivisor = format.getSampleRate() * (format.getSampleSizeInBits() / 8) * format.
                    getChannels();

            currentTime = "00:00:00";
            duration = getTimeString(aFormat.getByteLength());

            timeDisplay.setText(currentTime + "/" + duration);

        }

        firePropertyChange("soundFile", oldSoundFile, this.soundFile);
    }

    public void stop() {
        if (audioFilePlayer != null && audioFilePlayer.isAlive()) {
            // System.out.println("audioFilePlayer.isAlive()");
            audioFilePlayer.interrupt();
            audioFilePlayer.stopPlaying();
            audioFilePlayer = null;
        }
    }

    public void forcePlay() {
        if (soundFile != null) {
            if (audioFilePlayer == null) {
                // System.out.println("audioFilePlayer == null");
                audioFilePlayer = new SoundFilePlayerRunnable(this.soundFile,
                        (Mixer.Info) soundOutOptions.getSelectedItem(),
                        this.durationSlider);
                audioFilePlayer.start();
            } else if (audioFilePlayer.isAlive()) {
                // System.out.println("audioFilePlayer.isAlive()");
                audioFilePlayer.interrupt();
                audioFilePlayer.stopPlaying();
                audioFilePlayer = new SoundFilePlayerRunnable(this.soundFile,
                        (Mixer.Info) soundOutOptions.getSelectedItem(),
                        this.durationSlider);
                audioFilePlayer.start();
            } else {
                // System.out.println("else");
                audioFilePlayer = new SoundFilePlayerRunnable(this.soundFile,
                        (Mixer.Info) soundOutOptions.getSelectedItem(),
                        this.durationSlider);
                audioFilePlayer.start();
            }
        }
    }

    protected void updateCurrentTime(int byteLength) {
        String t = getTimeString(byteLength);

        timeDisplay.setText(t + "/" + duration);
    }

    private String getTimeString(int byteLength) {
        if (timeDivisor <= 0.0f) {
            return "00:00:00";
        }

        float duration = byteLength / timeDivisor;

        int hours = (int) duration / 3600;
        duration = duration - (hours * 3600);

        int minutes = (int) duration / 60;
        duration = duration - (minutes * 60);

        String h = Integer.toString(hours);
        String m = Integer.toString(minutes);
        String s = Float.toString(duration);

        if (hours < 10) {
            h = "0" + h;
        }

        if (minutes < 10) {
            m = "0" + m;
        }

        if (duration < 10) {
            s = "0" + s;
        }

        return h + ":" + m + ":" + s.substring(0, 2);

    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jLabel3 = new javax.swing.JLabel();
        playStopButton = new javax.swing.JButton();
        timeDisplay = new javax.swing.JLabel();
        durationSlider = new javax.swing.JProgressBar();
        fileNameLabel = new javax.swing.JLabel();
        jLabel1 = new javax.swing.JLabel();
        soundOutOptions = new javax.swing.JComboBox();
        fileNameText = new javax.swing.JTextField();
        selectFileButton = new javax.swing.JButton();

        jLabel3.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.jLabel3.text")); // NOI18N

        playStopButton.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.playStopButton.text")); // NOI18N
        playStopButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                playStopButtonActionPerformed(evt);
            }
        });

        timeDisplay.setHorizontalAlignment(javax.swing.SwingConstants.TRAILING);
        timeDisplay.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.timeDisplay.text")); // NOI18N

        fileNameLabel.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.fileNameLabel.text")); // NOI18N

        jLabel1.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.jLabel1.text")); // NOI18N

        soundOutOptions.setModel(new javax.swing.DefaultComboBoxModel(AudioSystem.getMixerInfo()));

        fileNameText.setEditable(false);
        fileNameText.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.fileNameText.text")); // NOI18N

        selectFileButton.setText(org.openide.util.NbBundle.getMessage(AudioFilePlayer.class, "AudioFilePlayer.selectFileButton.text")); // NOI18N
        selectFileButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                selectFileButtonActionPerformed(evt);
            }
        });

        org.jdesktop.layout.GroupLayout layout = new org.jdesktop.layout.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                    .add(layout.createSequentialGroup()
                        .add(jLabel1)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, timeDisplay, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 322, Short.MAX_VALUE)
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, durationSlider, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 322, Short.MAX_VALUE)
                            .add(org.jdesktop.layout.GroupLayout.TRAILING, layout.createSequentialGroup()
                                .add(fileNameText, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 269, Short.MAX_VALUE)
                                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                                .add(selectFileButton))))
                    .add(layout.createSequentialGroup()
                        .add(jLabel3)
                        .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                        .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                            .add(soundOutOptions, 0, 324, Short.MAX_VALUE)
                            .add(playStopButton, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 324, Short.MAX_VALUE))))
                .addContainerGap())
            .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                .add(layout.createSequentialGroup()
                    .add(36, 36, 36)
                    .add(fileNameLabel, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, 354, Short.MAX_VALUE)
                    .addContainerGap()))
        );

        layout.linkSize(new java.awt.Component[] {jLabel1, jLabel3}, org.jdesktop.layout.GroupLayout.HORIZONTAL);

        layout.setVerticalGroup(
            layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
            .add(layout.createSequentialGroup()
                .addContainerGap()
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel1)
                    .add(fileNameText, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                    .add(selectFileButton))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(durationSlider, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(timeDisplay)
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.BASELINE)
                    .add(jLabel3)
                    .add(soundOutOptions, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE, org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, org.jdesktop.layout.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(org.jdesktop.layout.LayoutStyle.RELATED)
                .add(playStopButton)
                .addContainerGap(org.jdesktop.layout.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
            .add(layout.createParallelGroup(org.jdesktop.layout.GroupLayout.LEADING)
                .add(layout.createSequentialGroup()
                    .add(97, 97, 97)
                    .add(fileNameLabel)
                    .addContainerGap(47, Short.MAX_VALUE)))
        );
    }// </editor-fold>//GEN-END:initComponents

    private void playStopButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_playStopButtonActionPerformed
        if (soundFile != null) {
            if (audioFilePlayer == null) {
                // System.out.println("audioFilePlayer == null");
                audioFilePlayer = new SoundFilePlayerRunnable(this.soundFile,
                        (Mixer.Info) soundOutOptions.getSelectedItem(),
                        this.durationSlider);
                audioFilePlayer.start();
            } else if (audioFilePlayer.isAlive()) {
                // System.out.println("audioFilePlayer.isAlive()");
                audioFilePlayer.interrupt();
                audioFilePlayer.stopPlaying();
                audioFilePlayer = null;
            } else {
                // System.out.println("else");
                audioFilePlayer = new SoundFilePlayerRunnable(this.soundFile,
                        (Mixer.Info) soundOutOptions.getSelectedItem(),
                        this.durationSlider);
                audioFilePlayer.start();
            }
        }
    }//GEN-LAST:event_playStopButtonActionPerformed

    private void selectFileButtonActionPerformed(java.awt.event.ActionEvent evt) {//GEN-FIRST:event_selectFileButtonActionPerformed
        int rValue = FileChooserManager.getDefault().showOpenDialog(
                this.getClass(), null);

        if (rValue == JFileChooser.APPROVE_OPTION) {
            File f = FileChooserManager.getDefault().getSelectedFile(this.
                    getClass());
            setSoundFile(f);
        }
        
    }//GEN-LAST:event_selectFileButtonActionPerformed
    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JProgressBar durationSlider;
    private javax.swing.JLabel fileNameLabel;
    private javax.swing.JTextField fileNameText;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JButton playStopButton;
    private javax.swing.JButton selectFileButton;
    private javax.swing.JComboBox soundOutOptions;
    private javax.swing.JLabel timeDisplay;
    // End of variables declaration//GEN-END:variables

    class SoundFilePlayerRunnable extends Thread {

        File soundFile;

        Mixer.Info mixer;

        JProgressBar slider;

        boolean stopPlaying;

        public SoundFilePlayerRunnable(File soundFile, Mixer.Info mixer,
                JProgressBar slider) {
            this.soundFile = soundFile;
            this.mixer = mixer;
            this.slider = slider;
        }

        public void stopPlaying() {
            this.stopPlaying = true;
        }

        public void run() {
            playAudioFile(soundFile);
        }

        public void playAudioFile(File soundFile) {
            AudioInputStream ain;
            AudioFileFormat aFormat;
            int bufferSize = 40960;

            try {
                aFormat = AudioSystem.getAudioFileFormat(soundFile);
                ain = AudioSystem.getAudioInputStream(soundFile);
                // mixer = (Mixer.Info)sou
                AudioFormat format = aFormat.getFormat();
                // Mixer mx = AudioSystem.getMixer(mixer);

                DataLine.Info targetInfo = new DataLine.Info(
                        SourceDataLine.class, format, 40960);
                if (!AudioSystem.isLineSupported(targetInfo)) {
                    JOptionPane.showMessageDialog(
                            null,
                            BlueSystem.getString(
                            "soundfile.player.error.lineUnsupported"));
                    return;
                }

                SourceDataLine b = (SourceDataLine) AudioSystem.getLine(
                        targetInfo);
                int read;
                byte[] buffer = new byte[bufferSize];

                b.open(format, bufferSize);
                b.start();

                slider.setMinimum(0);
                slider.setMaximum(aFormat.getByteLength());
                slider.setValue(0);

                while ((read = ain.read(buffer)) != -1) {
                    if (stopPlaying) {
                        break;
                    }
                    b.write(buffer, 0, read);

                    int bytesRead = slider.getValue() + read;
                    slider.setValue(bytesRead);
                    updateCurrentTime(bytesRead);
                }

                if (!stopPlaying) {
                    b.drain();
                }
                b.stop();
                b.close();

                // System.out.println(mixer);
                // System.out.println(aFormat);
            } catch (IllegalArgumentException iae) {
                JOptionPane.showMessageDialog(null, iae.getLocalizedMessage());
            } catch (LineUnavailableException lue) {
                JOptionPane.showMessageDialog(null, lue.getLocalizedMessage());
            } catch (FileNotFoundException fe) {
                JOptionPane.showMessageDialog(null, BlueSystem.getString(
                        "message.file.notFound"));
            } catch (Exception e) {
                e.printStackTrace();
            }

            slider.setValue(0);
        }
    }
}
