/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2020 Steven Yi (stevenyi@gmail.com)
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
package blue.automation;

import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LinePoint;
import blue.ui.core.score.undo.LineChangeEdit;
import blue.ui.utilities.FileChooserManager;
import blue.undo.BlueUndoManager;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.filechooser.FileNameExtensionFilter;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
class EditPointsPopup extends JPopupMenu {

    private static final String FILE_BPF_IMPORT = "paramaterLinePanel.bpf_import";

    private static final String FILE_BPF_EXPORT = "paramaterLinePanel.bpf_export";

    static {
        FileChooserManager fcm = FileChooserManager.getDefault();

        fcm.addFilter(FILE_BPF_IMPORT, new FileNameExtensionFilter(
                "Break Point File", "bpf"));

        fcm.addFilter(FILE_BPF_EXPORT, new FileNameExtensionFilter(
                "Break Point File", "bpf"));

        fcm.setDialogTitle(FILE_BPF_IMPORT, "Import BPF File");
        fcm.setDialogTitle(FILE_BPF_EXPORT, "Export BPF File");
    }

    Line line = null;
    JMenu selectParameterMenu;
    ActionListener paramItemListener;
    Action editPointsAction;
    Action resetLine;
    Action importBPF;
    Action exportBPF;
    private final ParameterLinePanel paramLinePanel;

    public EditPointsPopup(final ParameterLinePanel paramLinePanel) {
        this.paramLinePanel = paramLinePanel;
        selectParameterMenu = new JMenu("Select Parameter");
        editPointsAction = new AbstractAction("Edit Points") {
            @Override
            public void actionPerformed(ActionEvent e) {
                Component root = SwingUtilities.getRoot(getInvoker());
                LineEditorDialog dialog = LineEditorDialog.getInstance(root);
                dialog.setLine(line);

                final var sourceCopy = new Line(line);
                dialog.ask();

                if (!line.equals(sourceCopy)) {
                    final var edit = new LineChangeEdit(line, sourceCopy, new Line(line));
                    BlueUndoManager.addEdit("score", edit);
                }
            }
        };

        resetLine = new AbstractAction("Reset Line") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (line != null) {
                    var linePoints = line.getObservableList();
                    linePoints.clear();
                    linePoints.add(new LinePoint(0, 0.5));
                    if (line.isRightBound()) {
                        linePoints.add(new LinePoint(1.0, 0.5));
                    }
                }
            }
        };

        paramItemListener = (ActionEvent e) -> {
            JMenuItem menuItem = (JMenuItem) e.getSource();
            Parameter param = (Parameter) menuItem.getClientProperty("param");
            paramLinePanel.parameterIdList.setSelectedParameter(param.getUniqueId());
            paramLinePanel.repaint();
        };
        exportBPF = new AbstractAction("Export BPF") {
            @Override
            public void actionPerformed(ActionEvent arg0) {
                if (line != null && line.size() > 0) {
                    File retVal = FileChooserManager.getDefault().showSaveDialog(FILE_BPF_EXPORT, SwingUtilities.getRoot(paramLinePanel));
                    if (retVal != null) {
                        File f = retVal;
                        try {
                            try (final PrintWriter out = new PrintWriter(new FileWriter(f))) {
                                out.print(line.exportBPF());
                                out.flush();
                            }
                            JOptionPane.showMessageDialog(SwingUtilities.getRoot(paramLinePanel), "Line Exported as: " + f.getAbsolutePath());
                        } catch (IOException e) {
                            Exceptions.printStackTrace(e);
                        }
                    }
                }
            }
        };
        importBPF = new AbstractAction("Import BPF") {
            @Override
            public void actionPerformed(ActionEvent arg0) {
                if (line != null && line.size() > 0) {
                    var retVal = FileChooserManager.getDefault().showOpenDialog(FILE_BPF_IMPORT, SwingUtilities.getRoot(paramLinePanel));
                    if (retVal != null && retVal.size() == 1) {
                        File f = retVal.get(0);
                        if (!line.importBPF(f)) {
                            JOptionPane.showMessageDialog(SwingUtilities.getRoot(paramLinePanel), "Failed to import BPF from file " + f.getAbsolutePath());
                        }
                    }
                }
            }
        };

        this.add(selectParameterMenu);

        this.add(editPointsAction);

        this.add(resetLine);

        this.addSeparator();

        this.add(importBPF);

        this.add(exportBPF);
    }

    public void repopulate() {
        selectParameterMenu.removeAll();
        if (paramLinePanel.paramList == null || paramLinePanel.paramList.size() == 0) {
            return;
        }
        for (int i = 0; i < paramLinePanel.paramList.size(); i++) {
            Parameter param = paramLinePanel.paramList.get(i);
            JMenuItem item = new JMenuItem();
            item.setText(param.getName());
            item.setEnabled(param != paramLinePanel.currentParameter);
            item.putClientProperty("param", param);
            item.addActionListener(paramItemListener);
            selectParameterMenu.add(item);
        }
    }

    public void setLine(Line line) {
        this.line = line;
    }

    @Override
    public void show(Component invoker, int x, int y) {
        if (paramLinePanel.paramList != null) {
            repopulate();
            editPointsAction.setEnabled(this.line != null);
            boolean bpfEnabled = (this.line != null) && (paramLinePanel.currentParameter.getResolution().doubleValue() <= 0);
            importBPF.setEnabled(bpfEnabled);
            exportBPF.setEnabled(bpfEnabled);
            super.show(invoker, x, y);
        }
    }

}
