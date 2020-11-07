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
import blue.soundObject.editor.pianoRoll.undo.UndoablePropertyEdit;
import blue.soundObject.pianoRoll.PianoNote;
import blue.soundObject.pianoRoll.Scale;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
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
import javax.swing.undo.UndoManager;

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
    
    FieldDefinitionsEditor fieldDefinitionsEditor;
    
    private PianoRoll p;
    
    private boolean isUpdating;
    
    private final ObservableList<PianoNote> selectedNotes;
    private final UndoManager undoManager;
    
    private final PropertyChangeListener pcl = new PropertyChangeListener() {
        @Override
        public void propertyChange(PropertyChangeEvent pce) {
            
            if (isUpdating) {
                return;
            }
            
            isUpdating = true;
            switch (pce.getPropertyName()) {
                case "scale": {
                    var oldVal = (Scale) pce.getOldValue();
                    var newVal = (Scale) pce.getNewValue();
                    oldVal.removePropertyChangeListener(this);
                    newVal.addPropertyChangeListener(this);
                    scalePanel.setScale(newVal);
                }
                break;
                case "pchGenerationMethod": {
                    int method = (Integer) pce.getNewValue();
                    switch (method) {
                        case PianoRoll.GENERATE_FREQUENCY:
                            frequencyOption.setSelected(true);
                            break;
                        case PianoRoll.GENERATE_PCH:
                            pchOption.setSelected(true);
                            break;
                        case PianoRoll.GENERATE_MIDI:
                            midiOption.setSelected(true);
                            break;
                    }
                }
                break;
                case "transposition": {
                    transposition.setValue((Integer) pce.getNewValue());
                }
                break;
                case "baseFrequency": {
                    baseFrequencyText.setText(Double.toString((Double) pce.getNewValue()));
                }
                break;
            }
            isUpdating = false;
            
        }
        
    };
    
    public PianoRollPropertiesEditor(ObservableList<PianoNote> selectedNotes, UndoManager undoManager) {
        
        this.selectedNotes = selectedNotes;
        this.undoManager = undoManager;
        
        LabelledItemPanel mainPanel = new LabelledItemPanel();
        
        ActionListener timeActionListener = (ActionEvent e) -> {
            if (!isUpdating) {
                isUpdating = true;
                
                int oldVal = p.getPchGenerationMethod();
                
                if (e.getSource() == frequencyOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_FREQUENCY);
                } else if (e.getSource() == pchOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_PCH);
                } else if (e.getSource() == midiOption) {
                    p.setPchGenerationMethod(PianoRoll.GENERATE_MIDI);
                }
                
                int newVal = p.getPchGenerationMethod();
                
                undoManager.addEdit(new UndoablePropertyEdit<Integer>(v -> {
                    p.setPchGenerationMethod(v);
                }, oldVal, newVal));
                
                isUpdating = false;
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
        JButton resetAllNotesButton = new JButton("Reset All Notes");
        
        noteTemplatePanel.add(noteTemplateText, BorderLayout.CENTER);
        noteTemplatePanel.add(resetAllNotesButton, BorderLayout.EAST);
        
        mainPanel.addItem(BlueSystem.getString("pianoRoll.instrumentID"),
                instrumentIDText);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.noteTemplate"),
                noteTemplatePanel);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.scale"), scalePanel);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.baseFrequency"),
                baseFrequencyText);
        mainPanel.addItem(BlueSystem.getString("pianoRoll.pchGeneration"), buttonPanel);
        
        mainPanel.addItem("Transposition:", transposition); // TODO - Translate!

        fieldDefinitionsEditor = new FieldDefinitionsEditor(undoManager);        
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
                new SimpleDocumentListener() {
            @Override
            public void documentChanged(DocumentEvent e) {
                if (p != null && !isUpdating) {
                    isUpdating = true;
                    p.setNoteTemplate(noteTemplateText.getText());
                    isUpdating = false;
                }
            }
        });
        
        resetAllNotesButton.setToolTipText("Reset all notes with overridden templates to use the PianoRoll's note template.");
        resetAllNotesButton.addActionListener((ActionEvent e) -> {
            resetAllNoteTemplates();
        });
        
        instrumentIDText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
            @Override
            public void documentChanged(DocumentEvent e) {
                if (p != null && !isUpdating) {
                    isUpdating = true;
                    p.setInstrumentId(instrumentIDText.getText());
                    isUpdating = false;
                }
            }
        });
        
        this.setViewportView(mainPanel);
        this.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        this.setBorder(null);
        
        scalePanel.addChangeListener((ChangeEvent e) -> {
            if (p != null && !isUpdating) {
                isUpdating = true;
                final var oldVal = p.getScale();
                final var newVal = scalePanel.getScale();
                
                oldVal.removePropertyChangeListener(pcl);
                newVal.addPropertyChangeListener(pcl);
                p.setScale(newVal);
                
                undoManager.addEdit(
                        new UndoablePropertyEdit<Scale>(v -> {
                            p.setScale(v);
                        }, oldVal, newVal));
                isUpdating = false;
            }
        });
        
        setupUndo();
    }
    
    protected void setupUndo() {
        instrumentIDText.getDocument().addUndoableEditListener(undoManager);
        noteTemplateText.getDocument().addUndoableEditListener(undoManager);
        
    }

    /**
     *
     */
    protected void updateTransposition() {
        if (p == null || isUpdating) {
            return;
        }
        
        Integer val = (Integer) transposition.getValue();
        
        final int oldVal = p.getTransposition();
        final int newVal = val.intValue();
        
        isUpdating = true;
        p.setTransposition(newVal);
        
        undoManager.addEdit(new UndoablePropertyEdit<Integer>(v -> {
            p.setTransposition(v);
        }, oldVal, newVal));
        isUpdating = false;
    }

    /**
     *
     */
    protected void resetAllNoteTemplates() {
        if (p == null || isUpdating) {
            return;
        }
        
        for (PianoNote note : p.getNotes()) {
            note.setNoteTemplate(null);
        }
    }
    
    protected void updateBaseFrequency() {
        if (p == null || isUpdating) {
            return;
        }
        
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
        
        isUpdating = true;
        var oldVal = p.getScale().getBaseFrequency();
        p.getScale().setBaseFrequency(newValue);
        
        undoManager.addEdit(
                new UndoablePropertyEdit<Double>(v -> {
                    p.getScale().setBaseFrequency(v);
                }, oldVal, newValue));
        
        isUpdating = false;
    }
    
    public void editPianoRoll(PianoRoll p) {
        isUpdating = true;
        
        if (this.p != null) {
            this.p.removePropertyChangeListener(pcl);
            this.p.getScale().removePropertyChangeListener(pcl);
        }
        this.p = null;
        
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
        
        fieldDefinitionsEditor.editPianoRoll(p);
        
        this.p = p;
        this.p.addPropertyChangeListener(pcl);
        this.p.getScale().addPropertyChangeListener(pcl);
        isUpdating = false;
    }
    
}
