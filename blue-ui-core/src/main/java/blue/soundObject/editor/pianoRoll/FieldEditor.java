/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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

import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.FieldDef;
import blue.soundObject.pianoRoll.FieldType;
import blue.soundObject.pianoRoll.PianoNote;
import blue.utilities.scales.ScaleLinear;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeListener;
import javafx.beans.property.ObjectProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.JPanel;
import javax.swing.ToolTipManager;
import javax.swing.undo.UndoManager;

/**
 *
 * @author stevenyi
 */
public class FieldEditor extends JPanel {

    FieldDef selectedField = null;

    private final ObservableList<PianoNote> selectedNotes;
    private final ObjectProperty<FieldDef> selectedFieldDef;
    private final ObjectProperty<PianoRoll> currentPianoRoll;
    final ScaleLinear yScale;

    ChangeListener<? super Number> domainListener;

    FieldEditorMouseListener fieldEditorMouseListener;

    ListChangeListener<PianoNote> lcl;

    PropertyChangeListener pcl;
    private final UndoManager undoManager;

    public FieldEditor(ObjectProperty<PianoRoll> currentPianoRoll,
            ObservableList<PianoNote> selectedNotes,
            ObjectProperty<FieldDef> selectedFieldDef,
            ScaleLinear yScale, UndoManager undoManager) {
        this.selectedNotes = selectedNotes;
        this.selectedFieldDef = selectedFieldDef;
        this.currentPianoRoll = currentPianoRoll;
        this.yScale = yScale;
        this.undoManager = undoManager;

        setLayout(null);
        setBackground(Color.BLACK);

        fieldEditorMouseListener = new FieldEditorMouseListener(currentPianoRoll, 
                selectedNotes, selectedFieldDef, yScale, undoManager);

        this.addMouseListener(fieldEditorMouseListener);
        this.addMouseMotionListener(fieldEditorMouseListener);

        ListChangeListener<PianoNote> selectionListener = chg -> repaint();

        this.selectedNotes.addListener(selectionListener);

        this.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                var bottom = getHeight() - 5;
                var top = 5;
                yScale.setRange(bottom, top);
                repaint();
            }
        });

        lcl = (change) -> {
            while (change.next()) {
                if (change.wasAdded()) {
                    for (PianoNote note : change.getAddedSubList()) {
                        var field = note.getField(selectedField);
                        field.ifPresent(fld -> {
                            var p = this.currentPianoRoll.get();
                            Pin pin = new Pin(p, yScale, note, fld, selectedNotes);
                            add(pin);
                        });
                    }
                } else if (change.wasRemoved()) {
                    // TODO: Change this algorithm
                    for (var note : change.getRemoved()) {
                        for (var c : getComponents()) {
                            if (c instanceof Pin) {
                                Pin p = (Pin) c;
                                if (p.note == note) {
                                    remove(p);
                                    break;
                                }
                            }
                        }
                    }
                }

            }
            repaint();
        };

        addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 2) {
                    selectedNotes.clear();
                }
            }

        });

        domainListener = (ov, t, t1) -> {
            yScale.setDomain(selectedField.getMinValue(), selectedField.getMaxValue());
        };

        ChangeListener<? super FieldDef> selectedFieldListener = (obs, old, newVal) -> {
            updateSelectedFieldDef(newVal);
        };
        selectedFieldDef.addListener(selectedFieldListener);

        ToolTipManager.sharedInstance().registerComponent(this);

        pcl = (pce) -> {
            if ("pixelSecond".equals(pce.getPropertyName())) {
                repaint();
            }
        };

        this.currentPianoRoll.addListener((obs, old, newVal) -> {
            if (old != null) {
                old.getNotes().removeListener(lcl);
                old.removePropertyChangeListener(pcl);
            }

            if (newVal != null) {
                newVal.getNotes().addListener(lcl);
                newVal.addPropertyChangeListener(pcl);
            }
        });
    }

    @Override
    public String getToolTipText(MouseEvent e) {

        String tip = null;

        Object obj = this.getComponentAt(e.getPoint());
        if (obj instanceof Pin) {

            var pin = (Pin) obj;
            var fd = pin.field;

            if (fd.getFieldDef().getFieldType() == FieldType.DISCRETE) {
                tip = Integer.toString((int) fd.getValue());
            } else {
                tip = String.format("%.3g", fd.getValue());
            }

        }

        return tip;
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g); //To change body of generated methods, choose Tools | Templates.

        var p = currentPianoRoll.get();

        if (selectedField == null || p == null) {
            return;
        }

        var pixelSecond = p.getPixelSecond();

        var bottom = getHeight() - 5;

        var g2d = (Graphics2D) g;
        g2d.setStroke(new BasicStroke(2));
        for (var note : p.getNotes()) {
            var x = (int) (pixelSecond * note.getStart());

            var field = note.getFields().stream()
                    .filter(f -> f.getFieldDef() == selectedField)
                    .findFirst();

            if (field.isPresent()) {

                g.setColor(selectedNotes.contains(note)
                        ? Color.LIGHT_GRAY : Color.DARK_GRAY);

                var y = yScale.calc(field.get().getValue());
                g2d.drawLine(x, bottom, x, (int) y);
            }
        }
    }

    private void updateSelectedFieldDef(FieldDef fieldDef) {

        if (selectedField != null) {
            selectedField.minValueProperty().removeListener(domainListener);
            selectedField.maxValueProperty().removeListener(domainListener);
        }

        removeAll();

        selectedField = fieldDef;

        if (selectedField != null) {
            selectedField.minValueProperty().addListener(domainListener);
            selectedField.maxValueProperty().addListener(domainListener);

            yScale.setDomain(selectedField.getMinValue(), selectedField.getMaxValue());

            var p = currentPianoRoll.get();
            
            for (PianoNote note : currentPianoRoll.get().getNotes()) {
                var field = note.getField(selectedField);
                field.ifPresent(fld -> {
                    Pin pin = new Pin(p, yScale, note, fld, selectedNotes);
                    add(pin);
                });

            }
        }

        repaint();
    }

}
