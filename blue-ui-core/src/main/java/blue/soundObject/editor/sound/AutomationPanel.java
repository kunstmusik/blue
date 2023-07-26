/*
 * blue - object composition environment for csound
 * Copyright (C) 2020 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.soundObject.editor.sound;

import blue.automation.LineColors;
import blue.automation.Parameter;
import blue.components.LineCanvas;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.soundObject.Sound;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.event.ItemEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import javafx.collections.ListChangeListener;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;
import org.openide.DialogDescriptor;
import org.openide.DialogDisplayer;

/**
 *
 * Automation line panel for Sound SoundObject. Contains dropdown selector for
 * line to edit, edit button to choose what automations to edit, as well as line
 * panel and time bar for editing line values.
 *
 * @author Steven Yi
 */
public class AutomationPanel extends JPanel {

    LineList lineList = new LineList();

    LineCanvas lineView;

    private ListChangeListener lcl;
    private JComboBox lineSelectionDropdown;
    private LineListComboBoxModel lineListModel = new LineListComboBoxModel();

    Sound sound = null;
    private final TimeBar timeBar;
    
    ScoreObjectListener sObjListener;

    public AutomationPanel() {
        setLayout(new BorderLayout());

        lineView = new LineCanvas();
        lineView.setLineList(lineList);

        timeBar = new TimeBar();
        JScrollPane jsp = new JScrollPane(lineView);
        jsp.setColumnHeaderView(timeBar);
        
        this.add(jsp, BorderLayout.CENTER);

        // Line Selector
        JPanel lineSelectorPanel = new JPanel(new BorderLayout());

        lineListModel.setLineList(lineList);
        lineListModel.setSelectedItem(lineList.size() > 0 ? lineList.get(0) : null);

        lineSelectionDropdown = new JComboBox(lineListModel);

        JButton editAutomations = new JButton("Edit");
        editAutomations.addActionListener(ae -> showEditDialog());

        lineSelectorPanel.setLayout(new BoxLayout(lineSelectorPanel, BoxLayout.X_AXIS));

        lineSelectorPanel.add(new JLabel("Automations"));
        lineSelectorPanel.add(lineSelectionDropdown);
        lineSelectorPanel.add(editAutomations);

        lineSelectionDropdown.addItemListener((e) -> {
            if(e.getStateChange() == ItemEvent.SELECTED) {
                lineView.setSelectedLine((Line) e.getItem());
            }
        });
        this.add(lineSelectorPanel, BorderLayout.SOUTH);
        
        sObjListener = e -> {
           switch(e.getPropertyChanged()) {
               case ScoreObjectEvent.START_TIME:
               case ScoreObjectEvent.DURATION:
                   updateTimeValues();
                   break;
           }
        };
    }
    
    protected void updateTimeValues() {
        timeBar.setStartTime(sound.getStartTime());
        timeBar.setDuration(sound.getSubjectiveDuration());
        lineView.setDataProjectionX(sound.getStartTime(), sound.getStartTime() + sound.getSubjectiveDuration());
    }

    public void editSound(Sound sound) {
        if(this.sound != null) {
            this.sound.removeScoreObjectListener(sObjListener);
        }
        this.sound = sound;
        
        if(this.sound != null) {
            this.sound.addScoreObjectListener(sObjListener);
        }
        
        updateTimeValues();

        UiUtilities.invokeOnSwingThread(() -> {
            updateParamOptions();
        });

    }

    protected void updateParamOptions() {
        var selected = lineSelectionDropdown.getSelectedItem();
        
        lineList.clear();

        if (sound != null) {
            int colorCount = 0;
            var lines = new ArrayList<Line>();
            for (Parameter p : sound.getBlueSynthBuilder().getParameterList().sorted()) {
                if (p.isAutomationEnabled()) {
                    p.getLine().setVarName(p.getName());
                    p.getLine().setColor(LineColors.getColor(colorCount++));
                    List<LinePoint> points = p.getLine().getObservableList();
                    if (points.size() < 2) {
                        LinePoint lp = new LinePoint();
                        lp.setLocation(1.0, points.get(0).getY());
                        points.add(lp);
                    }
                    lines.add(p.getLine());
                }
            }
            lineList.addAll(lines);
        }
        if(selected != null) {
            lineSelectionDropdown.setSelectedItem(selected);
        } else if(lineList.size() > 0) {
            lineSelectionDropdown.setSelectedIndex(0);
        }
        lineView.repaint();
    }

    protected void showEditDialog() {
        if (sound == null) {
            return;
        }

        JTable table = new JTable();
        var params = sound.getBlueSynthBuilder().getParameterList().sorted();
        var options = params.stream()
                .map(p -> new ParamOption(p))
                .collect(Collectors.toList());
        table.setModel(new ParamOptionTableModel(options));

        var descriptor = new DialogDescriptor(new JScrollPane(table),
                "Choose Parameters to Automate",
                true, null);
        var res = DialogDisplayer.getDefault().notify(descriptor);
        if (res == DialogDescriptor.OK_OPTION) {
            for (var opt : options) {
                opt.param.setAutomationEnabled(opt.enabled);
            }
            UiUtilities.invokeOnSwingThread(() -> {
                updateParamOptions();
            });
        }
    }

    class ParamOptionTableModel implements TableModel {

        private final List<ParamOption> options;
        private final List<TableModelListener> listeners = new ArrayList<>();

        public ParamOptionTableModel(List<ParamOption> options) {
            this.options = options;
        }

        @Override
        public int getRowCount() {
            return options.size();
        }

        @Override
        public int getColumnCount() {
            return 2;
        }

        @Override
        public String getColumnName(int columnIndex) {
            return (columnIndex == 0) ? "Enabled" : "Parameter Name";
        }

        @Override
        public Class<?> getColumnClass(int columnIndex) {
            return columnIndex == 0 ? Boolean.class : String.class;
        }

        @Override
        public boolean isCellEditable(int rowIndex, int columnIndex) {
            return columnIndex == 0;
        }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            var val = options.get(rowIndex);
            return columnIndex == 0 ? val.enabled : val.param.getName();
        }

        @Override
        public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
            if (columnIndex == 0) {
                var val = options.get(rowIndex);
                val.enabled = (Boolean) aValue;
                var tme = new TableModelEvent(this, rowIndex, rowIndex, columnIndex);
                for (var l : listeners) {
                    l.tableChanged(tme);
                }
            }
        }

        @Override
        public void addTableModelListener(TableModelListener l) {
            listeners.add(l);
        }

        @Override
        public void removeTableModelListener(TableModelListener l) {
            listeners.remove(l);
        }

    }

    class ParamOption {

        public Parameter param;
        public boolean enabled;

        public ParamOption(Parameter p) {
            param = p;
            enabled = param.isAutomationEnabled();
        }
    }
}
