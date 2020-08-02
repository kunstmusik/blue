/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.pianoRoll;

import blue.BlueSystem;
import blue.gui.LabelledItemPanel;
import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.PianoNote;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import javafx.collections.ObservableList;
import javax.swing.ButtonGroup;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.ChangeEvent;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

/**
 * @author steven
 */
public class PianoRollPropertiesEditor extends JScrollPane {

    JTextField noteTemplateText = new JTextField();

    ScaleSelectionPanel scalePanel = new ScaleSelectionPanel();

    JTextField baseFrequencyText = new JTextField();

    JTextField instrumentIDText = new JTextField();

    JRadioButton frequencyOption = new JRadioButton(BlueSystem
            .getString("pianoRoll.frequency"));

    JRadioButton pchOption = new JRadioButton("blue PCH");

    JRadioButton midiOption = new JRadioButton("MIDI");

    SpinnerNumberModel intModel = new SpinnerNumberModel(0, Integer.MIN_VALUE,
            Integer.MAX_VALUE, 1);

    JSpinner transposition = new JSpinner(intModel);
    
    FieldDefinitionsEditor fieldDefinitionsEditor = new FieldDefinitionsEditor();

    private PianoRoll p;

    private boolean isUpdating;

    private final ObservableList<PianoNote> selectedNotes;
    
    
    public PianoRollPropertiesEditor(ObservableList<PianoNote> selectedNotes) {
        
        this.selectedNotes = selectedNotes;

        LabelledItemPanel mainPanel = new LabelledItemPanel();

        ActionListener timeActionListener = (ActionEvent e) -> {
            if (!isUpdating) {
                if (e.getSource() == frequencyOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_FREQUENCY);
                } else if (e.getSource() == pchOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_PCH);
                } else if (e.getSource() == midiOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_MIDI);
                }
            }
        };

        frequencyOption.addActionListener(timeActionListener);
        pchOption.addActionListener(timeActionListener);
        midiOption.addActionListener(timeActionListener);

        JPanel buttonPanel = new JPanel(new GridLayout(3, 1));
        buttonPanel.add(frequencyOption);
        buttonPanel.add(pchOption);
        buttonPanel.add(midiOption);

        ButtonGroup bg = new ButtonGroup();
        bg.add(frequencyOption);
        bg.add(pchOption);
        bg.add(midiOption);

        JPanel noteTemplatePanel = new JPanel(new BorderLayout());
        JButton setAllNotesButton = new JButton(BlueSystem
                .getString("pianoRoll.setAllNotes"));
        JButton setSelectedNotesButton = new JButton(BlueSystem
                .getString("pianoRoll.setSelectedNotes"));

        JPanel noteButtonPanel = new JPanel(new GridLayout(1, 2));
        noteButtonPanel.add(setSelectedNotesButton);
        noteButtonPanel.add(setAllNotesButton);

        noteTemplatePanel.add(noteTemplateText, BorderLayout.CENTER);
        noteTemplatePanel.add(noteButtonPanel, BorderLayout.EAST);

        mainPanel.addItem(BlueSystem.getString("pianoRoll.instrumentID"),
                instrumentIDText);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.noteTemplate"),
                noteTemplatePanel);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.scale"), scalePanel);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.baseFrequency"),
                baseFrequencyText);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.pchGeneration"), buttonPanel);

        mainPanel.addItem("Transposition:", transposition); // TODO - Translate!
        
        
        mainPanel.addItem("Additional Fields:", fieldDefinitionsEditor);

        baseFrequencyText.addFocusListener(new FocusAdapter() {

            @Override
            public void focusLost(FocusEvent e) {
                updateBaseFrequency();
            }

        });

        baseFrequencyText.addActionListener((ActionEvent e) -> {
            updateBaseFrequency();
        });

        transposition.addChangeListener((ChangeEvent e) -> {
            updateTransposition();
        });

        noteTemplateText.getDocument().addDocumentListener(
                new DocumentListener() {

                    @Override
                    public void insertUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    @Override
                    public void removeUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    @Override
                    public void changedUpdate(DocumentEvent e) {
                        updateNoteTemplate();
                    }

                    private void updateNoteTemplate() {
                        if (p != null && !isUpdating) {
                            p.setNoteTemplate(noteTemplateText.getText());
                        }
                    }

                });

        setAllNotesButton.addActionListener((ActionEvent e) -> {
            setAllNoteTemplates();
        });

        setSelectedNotesButton.addActionListener((ActionEvent e) -> {
            setSelectedNoteTemplates();
        });

        instrumentIDText.getDocument().addDocumentListener(
                new DocumentListener() {

                    @Override
                    public void insertUpdate(DocumentEvent e) {
                        updateInstrumentId();
                    }

                    @Override
                    public void removeUpdate(DocumentEvent e) {
                        updateInstrumentId();
                    }

                    @Override
                    public void changedUpdate(DocumentEvent e) {
                        updateInstrumentId();
                    }

                    private void updateInstrumentId() {
                        if (p != null && !isUpdating) {
                            p.setInstrumentId(instrumentIDText.getText());
                        }
                    }

                });

         this.setViewportView(mainPanel);
         this.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
         this.setBorder(null);

         scalePanel.addChangeListener((ChangeEvent e) -> {
             if (p != null) {
                 p.setScale(scalePanel.getScale());
             }
        });
    }

    /**
     * 
     */
    protected void updateTransposition() {
        if (p == null) {
            return;
        }

        Integer val = (Integer) transposition.getValue();

        p.setTransposition(val.intValue());
    }

    /**
     * 
     */
    protected void setAllNoteTemplates() {
        if (p == null) {
            return;
        }

        String noteTemplate = p.getNoteTemplate();

        for (PianoNote note : p.getNotes()) {
            note.setNoteTemplate(noteTemplate);
        }
    }

    protected void setSelectedNoteTemplates() {
        if (p == null) {
            return;
        }

        String noteTemplate = p.getNoteTemplate();

        for (var note : selectedNotes) {
            note.setNoteTemplate(noteTemplate);
        }
    }

    protected void updateBaseFrequency() {
        double newValue;

        try {
            newValue = Double.parseDouble(baseFrequencyText.getText());
        } catch (NumberFormatException nfe) {
            baseFrequencyText.setText(Double.toString(p.getScale()
                    .getBaseFrequency()));
            return;
        }

        if (newValue < 0.0f) {
            newValue = 0.0f;
        }

        p.getScale().setBaseFrequency(newValue);
    }

    public void editPianoRoll(PianoRoll p) {
        isUpdating = false;

        this.p = p;

        noteTemplateText.setText(p.getNoteTemplate());
        instrumentIDText.setText(p.getInstrumentId());
        baseFrequencyText.setText(Double.toString(p.getScale()
                .getBaseFrequency()));
        scalePanel.setScale(p.getScale());

        if (p.getPchGenerationMethod() == PianoRoll.GENERATE_FREQUENCY) {
            frequencyOption.setSelected(true);
        } else if (p.getPchGenerationMethod() == PianoRoll.GENERATE_PCH) {
            pchOption.setSelected(true);
        } else if (p.getPchGenerationMethod() == PianoRoll.GENERATE_MIDI) {
            midiOption.setSelected(true);
        }

        transposition.setValue(new Integer(p.getTransposition()));
        
        fieldDefinitionsEditor.setFieldDefinitions(p.getFieldDefinitions());

        isUpdating = false;
    }

}