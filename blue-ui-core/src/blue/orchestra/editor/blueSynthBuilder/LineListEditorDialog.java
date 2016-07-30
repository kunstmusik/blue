/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder;

import blue.components.lines.LineList;
import blue.components.lines.LineListTable;
import com.l2fprod.common.swing.BaseDialog;
import java.awt.BorderLayout;
import java.awt.Container;

public class LineListEditorDialog extends BaseDialog {

    private LineList lines;

    LineListTable table;

    public LineListEditorDialog() {
        super();

        this.getBanner().setVisible(false);

        table = new LineListTable();

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(table, BorderLayout.CENTER);

        this.setSize(400, 300);
    }

    public void setLineList(LineList lines) {
        this.lines = lines;
        table.setLineList(lines);
    }

    public LineList getLineList() {
        return lines;
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        // TODO Auto-generated method stub

    }

}
