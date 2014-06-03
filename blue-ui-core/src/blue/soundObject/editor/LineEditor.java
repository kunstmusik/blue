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

package blue.soundObject.editor;

import blue.components.LineCanvas;
import blue.components.lines.Line;
import blue.components.lines.LineListTable;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.LineObject;
import blue.utility.GUI;
import java.awt.BorderLayout;
import javax.swing.JSplitPane;

/**
 * @author Steven Yi
 */
@ScoreObjectEditorPlugin(scoreObjectType = LineEditor.class)
public class LineEditor extends ScoreObjectEditor {

    LineListTable lineTable = null;

    LineCanvas lineCanvas = null;

    public LineEditor() {
        lineTable = getNewLineTable();
        lineCanvas = getNewLineCanvas();

        this.setLayout(new BorderLayout());

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        splitPane.setDividerLocation(200);

        splitPane.add(lineTable, JSplitPane.LEFT);
        splitPane.add(lineCanvas, JSplitPane.RIGHT);

        lineTable.addTableModelListener(lineCanvas);

        lineTable.addSelectionListener(new SelectionListener() {

            @Override
            public void selectionPerformed(SelectionEvent e) {
                lineCanvas.setSelectedLine((Line) e.getSelectedItem());
            }

        });

        this.add(splitPane, BorderLayout.CENTER);
    }

    protected LineListTable getNewLineTable() {
        return new LineListTable();
    }

    protected LineCanvas getNewLineCanvas() {
        return new LineCanvas();
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            // this.line = null;

            return;
        }

        if (!(sObj instanceof LineObject)) {
            return;
        }

        LineObject lineObj = (LineObject) sObj;

        lineTable.setLineList(lineObj.getLines());
        lineCanvas.setLineList(lineObj.getLines());
    }

    public static void main(String[] args) {
        LineEditor lineEditor = new LineEditor();
        lineEditor.editScoreObject(new LineObject());
        GUI.showComponentAsStandalone(lineEditor, "Test Line Editor", true);
    }
}
