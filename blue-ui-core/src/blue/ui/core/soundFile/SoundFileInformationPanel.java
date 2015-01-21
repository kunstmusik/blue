package blue.ui.core.soundFile;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.io.File;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JTextField;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class SoundFileInformationPanel extends JComponent {
    JLabel durationText = new JLabel();

    JLabel formatTypeText = new JLabel();

    JLabel byteLengthText = new JLabel();

    JLabel encodingTypeText = new JLabel();

    JLabel sampleRateText = new JLabel();

    JLabel sampleSizeInBitsText = new JLabel();

    JLabel channelsText = new JLabel();

    JLabel isBigEndianText = new JLabel();

    JPanel ftablePanel = new JPanel();

    JTextField fTableText = new JTextField();

    JButton ftableCopyButton = new JButton();

    LabelledItemPanel itemPanel = new LabelledItemPanel();

    public SoundFileInformationPanel() {
        this.setLayout(new BorderLayout());

        ftablePanel.setLayout(new BorderLayout());
        ftablePanel.add(fTableText, BorderLayout.CENTER);
        ftablePanel.add(ftableCopyButton, BorderLayout.EAST);
        ftableCopyButton.addActionListener(new java.awt.event.ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                fTableText.selectAll();
                fTableText.copy();
            }
        });
        ftableCopyButton.setText(BlueSystem
                .getString("soundfile.infoPanel.copy"));

        itemPanel.addItem(BlueSystem.getString("soundfile.infoPanel.duration")
                + " ", durationText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.formatType")
                + " ", formatTypeText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.byteLength")
                + " ", byteLengthText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.encodingType")
                + " ", encodingTypeText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.sampleRate")
                + " ", sampleRateText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.sampleSize")
                + " ", sampleSizeInBitsText);
        itemPanel.addItem(BlueSystem.getString("soundfile.infoPanel.channels")
                + " ", channelsText);
        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.isBigEndian")
                + " ", isBigEndianText);

        itemPanel.addItem(BlueSystem
                .getString("soundfile.infoPanel.gen01table")
                + " ", ftablePanel);

        this.add(itemPanel, BorderLayout.CENTER);

    }

    public void setSoundFile(File soundFile) {
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
            channelsText.setText(Integer.toString(format.getChannels()));
            isBigEndianText.setText(getBooleanString(format.isBigEndian()));

            setFtableText(soundFile, aFormat.getByteLength());
            fTableText.copy();

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

    void setFtableText(File f, int byteLength) {
        String fTableString = "f0 0 " + closestPowerOfTwo(byteLength) + " 1 \""
                + f.getAbsolutePath() + "\" 0 0 0 ";

        fTableText.setText(fTableString);
    }

    private int closestPowerOfTwo(int byteLength) {
        int tableSize = 2;
        while (tableSize < byteLength) {
            tableSize = 2 * tableSize;
        }
        return tableSize;
    }

    void clearAudioInfo() {

    }

    private String getBooleanString(boolean val) {
        if (val) {
            return BlueSystem.getString("soundfile.infoPanel.true");
        }
        return BlueSystem.getString("soundfile.infoPanel.false");
    }

}