/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.ui.core.score.noteProcessorChain;

import java.awt.Color;
import java.awt.Component;
import javax.swing.JTable;
import javax.swing.table.TableCellRenderer;

public class NoteProcessorChainTable extends JTable {

    private static final Color HIGHLIGHTED_COLOR = new Color(127, 127, 127);

    int hilightRows[];

    @Override
    public Component prepareRenderer(TableCellRenderer renderer, int row,
            int column) {

        Component c = super.prepareRenderer(renderer, row, column);

        if (((NoteProcessorChainTableModel) this.getModel()).isTitleRow(row)) {
            c.setBackground(Color.darkGray);
        } else if (hilightRows != null && row >= hilightRows[0]
                && row <= hilightRows[1]) {
            c.setBackground(HIGHLIGHTED_COLOR);
            // c.setForeground(Color.BLACK);
        } else {
            c.setBackground(Color.black);
            // c.setForeground(Color.WHITE);
        }

        return c;
    }

    public void setHilightRows(int hilightRows[]) {
        this.hilightRows = hilightRows;
        this.repaint();
    }

    public NoteProcessorChainTable(NoteProcessorChainTableModel npcModel) {
        super(npcModel);
        this.setDoubleBuffered(false);

        this.setDefaultEditor(PropertyEditProxy.class,
                new PropertyEditProxyEditor());
    }
    
    @Override
    public boolean getScrollableTracksViewportHeight() {
        return getPreferredSize().height < getParent().getHeight();
    }

} 