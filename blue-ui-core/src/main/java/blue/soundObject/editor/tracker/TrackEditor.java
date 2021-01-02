/*
 * TrackEditor.java
 *
 * Created on August 9, 2006, 3:52 PM
 */

package blue.soundObject.editor.tracker;

import blue.BlueSystem;
import blue.soundObject.pianoRoll.Scale;
import blue.soundObject.tracker.Column;
import blue.soundObject.tracker.Track;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.SimpleDocumentListener;
import blue.utility.GUI;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.io.File;
import java.util.List;
import javax.swing.ListSelectionModel;
import javax.swing.SpinnerModel;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.DocumentEvent;
import javax.swing.event.ListSelectionEvent;
import javax.swing.filechooser.FileNameExtensionFilter;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableModel;

/**
 * 
 * @author steven
 */
public class TrackEditor extends javax.swing.JPanel {

    private static final String FILE_CHOOSER_ID = "scaleSelectionPanel";

    private final TableModel EMPTY_MODEL = new DefaultTableModel();

    private final SpinnerModel MIN_DOUBLE_MODEL;

    private final SpinnerModel MAX_DOUBLE_MODEL;

    private final SpinnerModel MIN_INT_MODEL;

    private final SpinnerModel MAX_INT_MODEL;

    boolean changingNumberModels = false;

    Column selectedColumn = null;

    /** Creates new form TrackEditor */
    public TrackEditor() {
        initComponents();

        initScaleFileSelector();

        Dimension miniScrollDim = new Dimension(9, 55);

        columnsScroll.getVerticalScrollBar().setPreferredSize(miniScrollDim);

        ActionListener al = (ActionEvent e) -> {
            if (selectedColumn == null) {
                return;
            }
            
            int colType = 0;
            
            if (e.getSource() == pchRadioButton) {
                colType = Column.TYPE_PCH;
            } else if (e.getSource() == bluePchRadioButton) {
                colType = Column.TYPE_BLUE_PCH;
            } else if (e.getSource() == midiRadioButton) {
                colType = Column.TYPE_MIDI;
            } else if (e.getSource() == stringRadioButton) {
                colType = Column.TYPE_STR;
            } else if (e.getSource() == numberRadioButton) {
                colType = Column.TYPE_NUM;
            }
            
            selectedColumn.setType(colType);
            setColumnUI(selectedColumn);
        };

        MIN_DOUBLE_MODEL = new SpinnerNumberModel(0.0d,
                Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, 1.0d) {

            @Override
            public void setValue(Object value) {
                if ((value == null) || !(value instanceof Number)) {
                    throw new IllegalArgumentException("illegal value");
                }

                if (selectedColumn != null && !changingNumberModels) {
                    Number numberMin = (Number) value;
                    Number numberMax = (Number) MAX_DOUBLE_MODEL.getValue();

                    if (numberMin.doubleValue() > numberMax.doubleValue()) {
                        throw new IllegalArgumentException(
                                "Value larger than max");
                    }
                }

                if (!value.equals(getValue())) {
                    super.setValue(value);
                }
            }

        };

        MAX_DOUBLE_MODEL = new SpinnerNumberModel(0.0d,
                Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, 1.0d) {

            @Override
            public void setValue(Object value) {
                if ((value == null) || !(value instanceof Number)) {
                    throw new IllegalArgumentException("illegal value");
                }

                if (selectedColumn != null && !changingNumberModels) {
                    Number numberMin = (Number) MIN_DOUBLE_MODEL.getValue();
                    Number numberMax = (Number) value;

                    if (numberMax.doubleValue() < numberMin.doubleValue()) {
                        throw new IllegalArgumentException(
                                "Value smaller than min");
                    }
                }

                if (!value.equals(getValue())) {
                    super.setValue(value);
                }
            }

        };

        MIN_INT_MODEL = new SpinnerNumberModel(0, Integer.MIN_VALUE,
                Integer.MAX_VALUE, 1) {

            @Override
            public void setValue(Object value) {
                if ((value == null) || !(value instanceof Number)) {
                    throw new IllegalArgumentException("illegal value");
                }

                if (selectedColumn != null && !changingNumberModels) {
                    Number numberMin = (Number) value;
                    Number numberMax = (Number) MAX_INT_MODEL.getValue();

                    if (numberMin.intValue() > numberMax.intValue()) {
                        throw new IllegalArgumentException(
                                "Value larger than max");
                    }
                }

                if (!value.equals(getValue())) {
                    super.setValue(value);
                }
            }

        };

        MAX_INT_MODEL = new SpinnerNumberModel(0, Integer.MIN_VALUE,
                Integer.MAX_VALUE, 1) {

            @Override
            public void setValue(Object value) {
                if ((value == null) || !(value instanceof Number)) {
                    throw new IllegalArgumentException("illegal value");
                }

                if (selectedColumn != null && !changingNumberModels) {
                    Number numberMin = (Number) MIN_INT_MODEL.getValue();
                    Number numberMax = (Number) value;

                    if (numberMax.intValue() < numberMin.intValue()) {
                        throw new IllegalArgumentException(
                                "Value smaller than min");
                    }
                }

                if (!value.equals(getValue())) {
                    super.setValue(value);
                }
            }

        };

        pchRadioButton.addActionListener(al);
        bluePchRadioButton.addActionListener(al);
        midiRadioButton.addActionListener(al);
        stringRadioButton.addActionListener(al);
        numberRadioButton.addActionListener(al);

        columnsTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        columnsTable.getSelectionModel().addListSelectionListener((ListSelectionEvent e) -> {
            if (!e.getValueIsAdjusting()) {
                int index = columnsTable.getSelectedRow();
                
                if (index < 0) {
                    // clear props ?
                    setColumn(null);
                } else {
                    setColumn(track.getColumn(index + 1));
                }
                
                removeColumnButton
                        .setEnabled((selectedColumn != null && track
                                .getRowCount() > 1));
                
                pushUpButton.setEnabled(index > 0);
                pushDownButton.setEnabled(index < columnsTable
                        .getModel().getRowCount() - 1);
            }
        });

        /*
         * Setting up listeners for track value changes and setting values to
         * track object
         */

        trackNameTextField.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (track != null) {
                            track.setName(trackNameTextField.getText());
                        }
                    }
                });

        noteTemplateTextField.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (track != null) {
                            track.setNoteTemplate(noteTemplateTextField
                                    .getText());
                        }
                    }
                });

        instrIdTextField.getDocument().addDocumentListener(
                new SimpleDocumentListener() {
                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (track != null) {
                            track.setInstrumentId(instrIdTextField.getText());
                        }
                    }
                });

        baseFreqText.addFocusListener(new FocusAdapter() {

            @Override
            public void focusLost(FocusEvent e) {
                updateBaseFrequency();
            }

        });

        baseFreqText.addActionListener((ActionEvent e) -> {
            updateBaseFrequency();
        });

        setTrack(null);
    }

    protected void updateBaseFrequency() {
        if (selectedColumn == null) {
            return;
        }

        double newValue;

        try {
            newValue = Double.parseDouble(baseFreqText.getText());
        } catch (NumberFormatException nfe) {
            baseFreqText.setText(Double.toString(selectedColumn.getScale()
                    .getBaseFrequency()));
            return;
        }

        if (newValue < 0.0f) {
            newValue = 0.0f;
        }

        selectedColumn.getScale().setBaseFrequency(newValue);
    }

    public synchronized void setTrack(Track track) {
        this.track = null;

        if (track == null) {
            GUI.setAllEnabled(this, false, true);

            trackNameTextField.setText("");
            noteTemplateTextField.setText("");
            instrIdTextField.setText("");

            pushUpButton.setEnabled(false);
            pushDownButton.setEnabled(false);
            removeColumnButton.setEnabled(false);

            columnsTable.setModel(EMPTY_MODEL);

            return;
        }

        GUI.setAllEnabled(this, true, true);

        pushUpButton.setEnabled(false);
        pushDownButton.setEnabled(false);
        removeColumnButton.setEnabled(false);

        trackNameTextField.setText(track.getName());
        noteTemplateTextField.setText(track.getNoteTemplate());
        instrIdTextField.setText(track.getInstrumentId());

        columnsTable.setModel(track);

        setColumn(null);

        this.track = track;
    }

    public void setColumn(Column col) {
        this.selectedColumn = null;

        if (col == null) {
            setColumnTypeEnabled(false);
            return;
        }

        setColumnTypeEnabled(true);

        setNumberModels(col);

        setColumnUI(col);

        this.selectedColumn = col;

    }

    private void setColumnTypeEnabled(boolean enabled) {
        colPropsLabel.setEnabled(enabled);

        pchRadioButton.setEnabled(enabled);

        bluePchRadioButton.setEnabled(enabled);
        scaleLabel.setEnabled(enabled);
        scaleNameTextField.setEnabled(enabled);
        scaleChooserButton.setEnabled(enabled);
        baseFreqLabel.setEnabled(enabled);
        baseFreqText.setEnabled(enabled);
        outputFreqCheckBox.setEnabled(enabled);

        midiRadioButton.setEnabled(enabled);

        stringRadioButton.setEnabled(enabled);

        numberRadioButton.setEnabled(enabled);
        restrictToIntegerCheckBox.setEnabled(enabled);
        useRangeCheckBox.setEnabled(enabled);
        numMinLabel.setEnabled(enabled);
        numberMinSpinner.setEnabled(enabled);
        numMaxLabel.setEnabled(enabled);
        numberMaxSpinner.setEnabled(enabled);

    }

    private void setColumnUI(Column column) {
        int colType = column.getType();

        switch (colType) {
            case Column.TYPE_PCH:
                pchRadioButton.setSelected(true);
                break;
            case Column.TYPE_BLUE_PCH:
                bluePchRadioButton.setSelected(true);
                break;
            case Column.TYPE_MIDI:
                midiRadioButton.setSelected(true);
                break;
            case Column.TYPE_STR:
                stringRadioButton.setSelected(true);
                break;
            case Column.TYPE_NUM:
                numberRadioButton.setSelected(true);
                break;
        }

        scaleLabel.setEnabled(colType == Column.TYPE_BLUE_PCH);
        scaleNameTextField.setEnabled(colType == Column.TYPE_BLUE_PCH);
        scaleChooserButton.setEnabled(colType == Column.TYPE_BLUE_PCH);
        baseFreqLabel.setEnabled(colType == Column.TYPE_BLUE_PCH);
        baseFreqText.setEnabled(colType == Column.TYPE_BLUE_PCH);
        outputFreqCheckBox.setEnabled(colType == Column.TYPE_BLUE_PCH);

        scaleNameTextField.setText(column.getScale().getScaleName());
        baseFreqText.setText(Double.toString(column.getScale()
                .getBaseFrequency()));
        outputFreqCheckBox.setSelected(column.isOutputFrequency());

        boolean isNumType = (colType == Column.TYPE_NUM);

        restrictToIntegerCheckBox.setEnabled(isNumType);
        useRangeCheckBox.setEnabled(isNumType);

        boolean rangeEnabled = (isNumType && column.isUsingRange());

        numberMaxSpinner.setEnabled(rangeEnabled);
        numberMinSpinner.setEnabled(rangeEnabled);
        numMinLabel.setEnabled(rangeEnabled);
        numMaxLabel.setEnabled(rangeEnabled);

        restrictToIntegerCheckBox.setSelected(column.isRestrictedToInteger());
        useRangeCheckBox.setSelected(column.isUsingRange());
    }

    private void setNumberModels(Column col) {
        changingNumberModels = true;
        if (col.isRestrictedToInteger()) {
            numberMinSpinner.setModel(MIN_INT_MODEL);
            numberMinSpinner.setValue(new Integer((int) col.getRangeMin()));

            numberMaxSpinner.setModel(MAX_INT_MODEL);
            numberMaxSpinner.setValue(new Integer((int) col.getRangeMax()));
        } else {
            numberMinSpinner.setModel(MIN_DOUBLE_MODEL);
            numberMinSpinner.setValue(new Double(col.getRangeMin()));

            numberMaxSpinner.setModel(MAX_DOUBLE_MODEL);
            numberMaxSpinner.setValue(new Double(col.getRangeMax()));
        }

        changingNumberModels = false;

    }

    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        columnTypeButtonGroup = new javax.swing.ButtonGroup();
        jLabel1 = new javax.swing.JLabel();
        jLabel2 = new javax.swing.JLabel();
        trackNameTextField = new javax.swing.JTextField();
        jLabel3 = new javax.swing.JLabel();
        columnsScroll = new javax.swing.JScrollPane();
        columnsTable = new javax.swing.JTable();
        removeColumnButton = new javax.swing.JButton();
        addColumnButton = new javax.swing.JButton();
        colPropsLabel = new javax.swing.JLabel();
        pchRadioButton = new javax.swing.JRadioButton();
        bluePchRadioButton = new javax.swing.JRadioButton();
        midiRadioButton = new javax.swing.JRadioButton();
        numberRadioButton = new javax.swing.JRadioButton();
        numberMinSpinner = new javax.swing.JSpinner();
        numMinLabel = new javax.swing.JLabel();
        numMaxLabel = new javax.swing.JLabel();
        numberMaxSpinner = new javax.swing.JSpinner();
        restrictToIntegerCheckBox = new javax.swing.JCheckBox();
        jLabel8 = new javax.swing.JLabel();
        noteTemplateTextField = new javax.swing.JTextField();
        jLabel7 = new javax.swing.JLabel();
        instrIdTextField = new javax.swing.JTextField();
        pushDownButton = new javax.swing.JButton();
        pushUpButton = new javax.swing.JButton();
        scaleLabel = new javax.swing.JLabel();
        stringRadioButton = new javax.swing.JRadioButton();
        scaleNameTextField = new javax.swing.JTextField();
        scaleChooserButton = new javax.swing.JButton();
        useRangeCheckBox = new javax.swing.JCheckBox();
        baseFreqLabel = new javax.swing.JLabel();
        baseFreqText = new javax.swing.JTextField();
        outputFreqCheckBox = new javax.swing.JCheckBox();

        jLabel1.setText("Track Properties");

        jLabel2.setText("Name:");

        trackNameTextField.setMaximumSize(new java.awt.Dimension(220, 28));

        jLabel3.setText("Columns");

        columnsTable.setModel(new javax.swing.table.DefaultTableModel(
            new Object [][] {
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null},
                {null, null, null, null}
            },
            new String [] {
                "Title 1", "Title 2", "Title 3", "Title 4"
            }
        ));
        columnsScroll.setViewportView(columnsTable);

        removeColumnButton.setText("-");
        removeColumnButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                removeColumnButtonActionPerformed(evt);
            }
        });

        addColumnButton.setText("+");
        addColumnButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                addColumnButtonActionPerformed(evt);
            }
        });

        colPropsLabel.setText("Column Properties");

        columnTypeButtonGroup.add(pchRadioButton);
        pchRadioButton.setText("PCH");
        pchRadioButton.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        pchRadioButton.setMargin(new java.awt.Insets(0, 0, 0, 0));

        columnTypeButtonGroup.add(bluePchRadioButton);
        bluePchRadioButton.setText("Blue PCH");
        bluePchRadioButton.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        bluePchRadioButton.setMargin(new java.awt.Insets(0, 0, 0, 0));

        columnTypeButtonGroup.add(midiRadioButton);
        midiRadioButton.setText("MIDI");
        midiRadioButton.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        midiRadioButton.setMargin(new java.awt.Insets(0, 0, 0, 0));

        columnTypeButtonGroup.add(numberRadioButton);
        numberRadioButton.setText("Number");
        numberRadioButton.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        numberRadioButton.setMargin(new java.awt.Insets(0, 0, 0, 0));

        numberMinSpinner.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                numberMinSpinnerStateChanged(evt);
            }
        });

        numMinLabel.setText("Min");

        numMaxLabel.setText("Max");

        numberMaxSpinner.addChangeListener(new javax.swing.event.ChangeListener() {
            public void stateChanged(javax.swing.event.ChangeEvent evt) {
                numberMaxSpinnerStateChanged(evt);
            }
        });

        restrictToIntegerCheckBox.setText("Restrict to Integer");
        restrictToIntegerCheckBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        restrictToIntegerCheckBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        restrictToIntegerCheckBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                restrictToIntegerCheckBoxActionPerformed(evt);
            }
        });

        jLabel8.setText("Note Template:");

        noteTemplateTextField.setMaximumSize(new java.awt.Dimension(220, 28));

        jLabel7.setText("Instrument ID:");

        instrIdTextField.setMaximumSize(new java.awt.Dimension(220, 28));

        pushDownButton.setText("V");
        pushDownButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushDownButtonActionPerformed(evt);
            }
        });

        pushUpButton.setText("^");
        pushUpButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                pushUpButtonActionPerformed(evt);
            }
        });

        scaleLabel.setText("Scale");

        columnTypeButtonGroup.add(stringRadioButton);
        stringRadioButton.setText("String");
        stringRadioButton.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        stringRadioButton.setMargin(new java.awt.Insets(0, 0, 0, 0));

        scaleNameTextField.setEditable(false);

        scaleChooserButton.setText("...");
        scaleChooserButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                scaleChooserButtonActionPerformed(evt);
            }
        });

        useRangeCheckBox.setText("Use Range");
        useRangeCheckBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        useRangeCheckBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        useRangeCheckBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                useRangeCheckBoxActionPerformed(evt);
            }
        });

        baseFreqLabel.setText("Base Freq");

        outputFreqCheckBox.setText("Output Frequencies");
        outputFreqCheckBox.setBorder(javax.swing.BorderFactory.createEmptyBorder(0, 0, 0, 0));
        outputFreqCheckBox.setMargin(new java.awt.Insets(0, 0, 0, 0));
        outputFreqCheckBox.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(java.awt.event.ActionEvent evt) {
                outputFreqCheckBoxActionPerformed(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(this);
        this.setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                    .addComponent(columnsScroll, javax.swing.GroupLayout.PREFERRED_SIZE, 0, Short.MAX_VALUE)
                    .addComponent(jLabel1)
                    .addComponent(jLabel3)
                    .addGroup(javax.swing.GroupLayout.Alignment.TRAILING, layout.createSequentialGroup()
                        .addComponent(pushUpButton)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(pushDownButton)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                        .addComponent(addColumnButton)
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addComponent(removeColumnButton))
                    .addGroup(layout.createSequentialGroup()
                        .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(jLabel8)
                            .addComponent(jLabel2)
                            .addComponent(jLabel7))
                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                        .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(trackNameTextField, javax.swing.GroupLayout.PREFERRED_SIZE, 216, javax.swing.GroupLayout.PREFERRED_SIZE)
                            .addComponent(noteTemplateTextField, javax.swing.GroupLayout.PREFERRED_SIZE, 216, javax.swing.GroupLayout.PREFERRED_SIZE)
                            .addComponent(instrIdTextField, javax.swing.GroupLayout.PREFERRED_SIZE, 216, javax.swing.GroupLayout.PREFERRED_SIZE)))
                    .addComponent(colPropsLabel)
                    .addComponent(bluePchRadioButton)
                    .addComponent(pchRadioButton)
                    .addComponent(midiRadioButton)
                    .addComponent(numberRadioButton)
                    .addComponent(stringRadioButton)
                    .addGroup(layout.createSequentialGroup()
                        .addGap(17, 17, 17)
                        .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                            .addComponent(restrictToIntegerCheckBox)
                            .addGroup(layout.createSequentialGroup()
                                .addGap(17, 17, 17)
                                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                                    .addComponent(numMaxLabel)
                                    .addComponent(numMinLabel))
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                                    .addComponent(numberMaxSpinner)
                                    .addComponent(numberMinSpinner, javax.swing.GroupLayout.Alignment.LEADING)))
                            .addComponent(useRangeCheckBox)
                            .addComponent(outputFreqCheckBox, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
                            .addGroup(layout.createSequentialGroup()
                                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
                                    .addComponent(baseFreqLabel)
                                    .addComponent(scaleLabel))
                                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.TRAILING)
                                    .addGroup(layout.createSequentialGroup()
                                        .addComponent(scaleNameTextField)
                                        .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                                        .addComponent(scaleChooserButton))
                                    .addComponent(baseFreqText, javax.swing.GroupLayout.Alignment.LEADING))))))
                .addContainerGap())
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addContainerGap()
                .addComponent(jLabel1)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel2)
                    .addComponent(trackNameTextField, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel8)
                    .addComponent(noteTemplateTextField, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jLabel7)
                    .addComponent(instrIdTextField, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(jLabel3)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(columnsScroll, javax.swing.GroupLayout.DEFAULT_SIZE, 73, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(pushUpButton)
                    .addComponent(pushDownButton)
                    .addComponent(removeColumnButton)
                    .addComponent(addColumnButton))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(colPropsLabel)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(pchRadioButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(bluePchRadioButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(scaleLabel)
                    .addComponent(scaleChooserButton)
                    .addComponent(scaleNameTextField, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(baseFreqLabel)
                    .addComponent(baseFreqText, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(outputFreqCheckBox)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(midiRadioButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(stringRadioButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(numberRadioButton)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(restrictToIntegerCheckBox)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addComponent(useRangeCheckBox)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(numMinLabel)
                    .addComponent(numberMinSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(numMaxLabel)
                    .addComponent(numberMaxSpinner, javax.swing.GroupLayout.PREFERRED_SIZE, javax.swing.GroupLayout.DEFAULT_SIZE, javax.swing.GroupLayout.PREFERRED_SIZE))
                .addContainerGap())
        );
    }// </editor-fold>//GEN-END:initComponents

    private void pushDownButtonActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_pushDownButtonActionPerformed
        if (track == null) {
            return;
        }

        int row = columnsTable.getSelectedRow();

        if (row < 0 || row > track.getRowCount() - 1) {
            return;
        }

        track.pushDownColumn(row);

        columnsTable.setRowSelectionInterval(row + 1, row + 1);
    }// GEN-LAST:event_pushDownButtonActionPerformed

    private void pushUpButtonActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_pushUpButtonActionPerformed
        if (track == null) {
            return;
        }

        int row = columnsTable.getSelectedRow();

        if (row < 1 || row > track.getRowCount()) {
            return;
        }

        track.pushUpColumn(row);

        columnsTable.setRowSelectionInterval(row - 1, row - 1);

    }// GEN-LAST:event_pushUpButtonActionPerformed

    private void outputFreqCheckBoxActionPerformed(
            java.awt.event.ActionEvent evt) {// GEN-FIRST:event_outputFreqCheckBoxActionPerformed
        if (selectedColumn != null) {
            selectedColumn.setOutputFrequency(outputFreqCheckBox.isSelected());
        }
    }// GEN-LAST:event_outputFreqCheckBoxActionPerformed

    private void scaleChooserButtonActionPerformed(
            java.awt.event.ActionEvent evt) {// GEN-FIRST:event_scaleChooserButtonActionPerformed
        if (selectedColumn == null) {
            return;
        }

        List<File> rValue = FileChooserManager.getDefault().showOpenDialog(FILE_CHOOSER_ID, this);

        if (!rValue.isEmpty()) {
            File f = rValue.get(0);

            if (!f.exists()) {
                return;
            }

            Scale scale = Scale.loadScale(f);

            selectedColumn.setScale(scale);

            scaleNameTextField.setText(scale.getScaleName());

        }
    }// GEN-LAST:event_scaleChooserButtonActionPerformed

    private void numberMaxSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {// GEN-FIRST:event_numberMaxSpinnerStateChanged
        if (selectedColumn != null && !changingNumberModels) {
            if (selectedColumn.isRestrictedToInteger()) {
                Integer val = (Integer) numberMaxSpinner.getValue();
                selectedColumn.setRangeMax(val.doubleValue());
            } else {
                Double val = (Double) numberMaxSpinner.getValue();
                selectedColumn.setRangeMax(val.doubleValue());
            }
        }
    }// GEN-LAST:event_numberMaxSpinnerStateChanged

    private void numberMinSpinnerStateChanged(javax.swing.event.ChangeEvent evt) {// GEN-FIRST:event_numberMinSpinnerStateChanged
        if (selectedColumn != null && !changingNumberModels) {
            if (selectedColumn.isRestrictedToInteger()) {
                Integer val = (Integer) numberMinSpinner.getValue();
                selectedColumn.setRangeMin(val.doubleValue());
            } else {
                Double val = (Double) numberMinSpinner.getValue();
                selectedColumn.setRangeMin(val.doubleValue());
            }
        }
    }// GEN-LAST:event_numberMinSpinnerStateChanged

    private void useRangeCheckBoxActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_useRangeCheckBoxActionPerformed
        if (selectedColumn != null) {

            boolean rangeEnabled = useRangeCheckBox.isSelected();

            selectedColumn.setUsingRange(rangeEnabled);

            numberMaxSpinner.setEnabled(rangeEnabled);
            numberMinSpinner.setEnabled(rangeEnabled);
            numMinLabel.setEnabled(rangeEnabled);
            numMaxLabel.setEnabled(rangeEnabled);
        }
    }// GEN-LAST:event_useRangeCheckBoxActionPerformed

    private void restrictToIntegerCheckBoxActionPerformed(
            java.awt.event.ActionEvent evt) {// GEN-FIRST:event_restrictToIntegerCheckBoxActionPerformed
        if (selectedColumn != null) {
            selectedColumn.setRestrictedToInteger(restrictToIntegerCheckBox
                    .isSelected());
            setNumberModels(selectedColumn);
        }
    }// GEN-LAST:event_restrictToIntegerCheckBoxActionPerformed

    private void removeColumnButtonActionPerformed(
            java.awt.event.ActionEvent evt) {// GEN-FIRST:event_removeColumnButtonActionPerformed
        if (selectedColumn == null || track == null) {
            return;
        }

        track.removeColumn(selectedColumn);
    }// GEN-LAST:event_removeColumnButtonActionPerformed

    private void addColumnButtonActionPerformed(java.awt.event.ActionEvent evt) {// GEN-FIRST:event_addColumnButtonActionPerformed
        Column col = new Column();

        col.setName("col" + (track.getRowCount() + 1));
        track.addColumn(col);
    }// GEN-LAST:event_addColumnButtonActionPerformed

    private void initScaleFileSelector() {
        final FileChooserManager fcm = FileChooserManager.getDefault();
        if (fcm.isDialogDefined(FILE_CHOOSER_ID)) {
            return;
        }

        fcm.setDialogTitle(FILE_CHOOSER_ID, BlueSystem
                .getString("pianoRoll.selectScalaFile"));
        fcm.addFilter(FILE_CHOOSER_ID, new FileNameExtensionFilter("Scala File (*.scl)", "scl"));

        // SET DEFAULT DIR
        String fileName = BlueSystem.getUserConfigurationDirectory();
        fileName += File.separator + "scl";

        File defaultDir = new File(fileName);

        if (defaultDir.exists() && defaultDir.isDirectory()) {
            fcm.setSelectedFile(FILE_CHOOSER_ID, defaultDir);
        }
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton addColumnButton;
    private javax.swing.JLabel baseFreqLabel;
    private javax.swing.JTextField baseFreqText;
    private javax.swing.JRadioButton bluePchRadioButton;
    private javax.swing.JLabel colPropsLabel;
    private javax.swing.ButtonGroup columnTypeButtonGroup;
    private javax.swing.JScrollPane columnsScroll;
    private javax.swing.JTable columnsTable;
    private javax.swing.JTextField instrIdTextField;
    private javax.swing.JLabel jLabel1;
    private javax.swing.JLabel jLabel2;
    private javax.swing.JLabel jLabel3;
    private javax.swing.JLabel jLabel7;
    private javax.swing.JLabel jLabel8;
    private javax.swing.JRadioButton midiRadioButton;
    private javax.swing.JTextField noteTemplateTextField;
    private javax.swing.JLabel numMaxLabel;
    private javax.swing.JLabel numMinLabel;
    private javax.swing.JSpinner numberMaxSpinner;
    private javax.swing.JSpinner numberMinSpinner;
    private javax.swing.JRadioButton numberRadioButton;
    private javax.swing.JCheckBox outputFreqCheckBox;
    private javax.swing.JRadioButton pchRadioButton;
    private javax.swing.JButton pushDownButton;
    private javax.swing.JButton pushUpButton;
    private javax.swing.JButton removeColumnButton;
    private javax.swing.JCheckBox restrictToIntegerCheckBox;
    private javax.swing.JButton scaleChooserButton;
    private javax.swing.JLabel scaleLabel;
    private javax.swing.JTextField scaleNameTextField;
    private javax.swing.JRadioButton stringRadioButton;
    private javax.swing.JTextField trackNameTextField;
    private javax.swing.JCheckBox useRangeCheckBox;
    // End of variables declaration//GEN-END:variables

    private Track track;

}
