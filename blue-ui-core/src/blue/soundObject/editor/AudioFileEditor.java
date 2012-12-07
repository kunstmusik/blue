/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.soundObject.editor;

import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;

import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextField;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.soundObject.AudioFile;
import blue.soundObject.SoundObject;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.SimpleDocumentListener;
import blue.utility.GUI;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

/**
 * @author Administrator
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class AudioFileEditor extends SoundObjectEditor {

    JTextField audioFileName = new JTextField();

    JButton findAudioFile = new JButton();

    MimeTypeEditorComponent csoundCode = new MimeTypeEditorComponent("text/x-csound-orc");

    AudioFile af = null;

    JLabel durationText = new JLabel();

    JLabel formatTypeText = new JLabel();

    JLabel byteLengthText = new JLabel();

    JLabel encodingTypeText = new JLabel();

    JLabel sampleRateText = new JLabel();

    JLabel sampleSizeInBitsText = new JLabel();

    JLabel channelsText = new JLabel();

    JLabel isBigEndianText = new JLabel();

    JLabel channelVariables = new JLabel();

    LabelledItemPanel audioFileInfoPanel = new LabelledItemPanel();
    
    UndoManager undo = new UndoRedo.Manager();

    public AudioFileEditor() {
        this.setLayout(new BorderLayout());

        JTabbedPane tabs = new JTabbedPane();

        findAudioFile.setText("...");
        findAudioFile.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {
                selectFile();
            }
        });
        findAudioFile.setToolTipText(BlueSystem
                .getString("audioFile.selectFile"));

        audioFileName.setEditable(false);

        csoundCode.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                if (af != null) {
                    af.setCsoundPostCode(csoundCode.getText());
                }
            }
        
        });
        
        csoundCode.setUndoManager(undo);
        csoundCode.getDocument().addUndoableEditListener(undo);

        // INFORMATION PANEL

        // audioFileInfoPanel.addItem(BlueSystem
        // .getString("soundfile.infoPanel.infoLabel"), new JPanel());
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.duration")
                + " ", durationText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.formatType")
                + " ", formatTypeText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.byteLength")
                + " ", byteLengthText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.encodingType")
                + " ", encodingTypeText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.sampleRate")
                + " ", sampleRateText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.sampleSize")
                + " ", sampleSizeInBitsText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.channels")
                + " ", channelsText);
        audioFileInfoPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.isBigEndian")
                + " ", isBigEndianText);

        // AUDIO FILE EDITOR

        JPanel audioEditPanel = new JPanel();
        audioEditPanel.setLayout(new BorderLayout());
        audioEditPanel.setBorder(new EmptyBorder(5, 5, 5, 5));

        JPanel filePanel = new JPanel();
        filePanel.setLayout(new BorderLayout());
        filePanel.add(new JLabel(BlueSystem
                .getString("audioFile.audioFileLabel")
                + " "), BorderLayout.WEST);
        filePanel.add(audioFileName, BorderLayout.CENTER);
        filePanel.add(findAudioFile, BorderLayout.EAST);
        filePanel.setBorder(new EmptyBorder(0, 0, 5, 0));

        audioEditPanel.add(filePanel, BorderLayout.NORTH);
        audioEditPanel.add(new JScrollPane(audioFileInfoPanel),
                BorderLayout.CENTER);

        tabs.add(BlueSystem.getString("audioFile.tabTitle"), audioEditPanel);

        // CSOUND CODE EDITOR

        JPanel csoundPanel = new JPanel();
        csoundPanel.setLayout(new BorderLayout());
        csoundPanel.setBorder(new EmptyBorder(5, 5, 5, 5));

        csoundPanel.add(channelVariables, BorderLayout.NORTH);
        csoundPanel.add(csoundCode, BorderLayout.CENTER);

        tabs.add("Csound", csoundPanel);

        this.add(tabs, BorderLayout.CENTER);
    }

    protected void selectFile() {
        int rValue = FileChooserManager.getDefault().showOpenDialog(this, this);

        if (rValue == JFileChooser.APPROVE_OPTION) {
            File temp = FileChooserManager.getDefault().getSelectedFile(this);
            if (temp.exists() && temp.isFile()) {
                try {
                    String absFilePath = temp.getCanonicalPath();
                    String relPath = BlueSystem.getRelativePath(absFilePath);

                    System.out.println("Rel Path: " + relPath);

                    af.setSoundFileName(relPath);
                    setAudioFileInfo(relPath);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else {
                JOptionPane.showMessageDialog(null, BlueSystem
                        .getString("message.file.notFound"));
            }
        }

    }

    public void editSoundObject(SoundObject sObj) {
        if (sObj == null) {
            System.err
                    .println("[AudioFileEditor::editSoundObject()] ERROR: null object passed in");
            af = null;
            return;
        }

        if (!sObj.getClass().getName().equals("blue.soundObject.AudioFile")) {
            System.err
                    .println("[AudioFileEditor::editSoundObject()] ERROR: not an instance of AudioFile");
            af = null;
            return;
        }

        af = (AudioFile) sObj;

        csoundCode.setText(af.getCsoundPostCode());
        setAudioFileInfo(af.getSoundFileName());
        
        undo.discardAllEdits();
    }

    private void setAudioFileInfo(String audioFile) {

        if (audioFile == null || audioFile.equals("")) {
            audioFileName.setText("Choose an Audio File");
            clearAudioInfo();
            return;
        }

        File soundFile = BlueSystem.findFile(audioFile);

        if (soundFile == null || !soundFile.exists() || !soundFile.isFile()) {
            audioFileName.setText("Could not find file: " + audioFile);
            clearAudioInfo();
            // Add option to find file

            return;
        }

        audioFileName.setText(audioFile);

        try {

            AudioFileFormat aFormat = AudioSystem.getAudioFileFormat(soundFile);
            AudioFormat format = aFormat.getFormat();

            durationText.setText(getDuration(aFormat, format));

            formatTypeText.setText(aFormat.getType().toString());
            byteLengthText.setText(Integer.toString(aFormat.getByteLength()));
            encodingTypeText.setText(format.getEncoding().toString());
            sampleRateText.setText(Float.toString(format.getSampleRate()));
            sampleSizeInBitsText.setText(Integer.toString(format
                    .getSampleSizeInBits()));

            int numChannels = format.getChannels();
            channelsText.setText(Integer.toString(numChannels));
            setChannelVariablesInfo(numChannels);

            isBigEndianText.setText(getBooleanString(format.isBigEndian()));

        } catch (java.io.IOException ioe) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("soundfile.infoPanel.error.couldNotOpenFile")
                    + " " + soundFile.getAbsolutePath());
            clearAudioInfo();
            return;
        } catch (javax.sound.sampled.UnsupportedAudioFileException uae) {
            JOptionPane.showMessageDialog(null, BlueSystem
                    .getString("soundfile.infoPanel.error.unsupportedAudio")
                    + " " + uae.getLocalizedMessage());
            clearAudioInfo();
            return;
        }
    }

    private void setChannelVariablesInfo(int numChannels) {

        if (numChannels <= 0) {
            channelVariables.setText("");
            return;
        }

        String info = BlueSystem.getString("audioFile.channelsMapped")
                + " aChannel1";

        int i = 1;

        while (i < numChannels) {
            i++;
            info += ", aChannel" + i;
        }

        channelVariables.setText(info);
    }

    private String getDuration(AudioFileFormat aFormat, AudioFormat format) {
        float duration = aFormat.getByteLength()
                / (format.getSampleRate() * (format.getSampleSizeInBits() / 8) * format
                        .getChannels());

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

        return h + ":" + m + ":" + s;

    }

    private String getBooleanString(boolean val) {
        if (val) {
            return BlueSystem.getString("soundfile.infoPanel.true");
        }
        return BlueSystem.getString("soundfile.infoPanel.false");
    }

    void clearAudioInfo() {
        durationText.setText("");

        formatTypeText.setText("");
        byteLengthText.setText("");
        encodingTypeText.setText("");
        sampleRateText.setText("");
        sampleSizeInBitsText.setText("");
        channelsText.setText("");
        isBigEndianText.setText("");

    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        BlueSystem.setCurrentProjectDirectory(new File("/home/steven"));

        AudioFileEditor afe = new AudioFileEditor();

        GUI.showComponentAsStandalone(afe, "Audio File Editor Test", true);

        afe.editSoundObject(new AudioFile());

    }
}