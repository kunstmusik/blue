/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

package blue.ui.core.blueLive;

import blue.blueLive.LiveObject;
import blue.blueLive.LiveObjectSet;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Rectangle;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JTable;
import javax.swing.border.Border;
import javax.swing.table.TableCellRenderer;

/**
 * 
 * @author steven
 */
public class LiveObjectRenderer extends JLabel implements TableCellRenderer {

    private LiveObjectSet set;
    Border highlightedBorder = BorderFactory.createLineBorder(Color.WHITE);
    
    private static final Object HIGHGLIGHTED = new Object();
    private static final Color HIGHLIGHT_PAINT = new Color(255, 255, 255, 128);
    
    public LiveObjectRenderer() {
        setOpaque(true);
    }

    public void setLiveObjectSet(LiveObjectSet set) {
        this.set = set;
    }
    
    @Override
    public Component getTableCellRendererComponent(JTable table, Object value,
            boolean isSelected, boolean hasFocus, int row, int column) {
        
        LiveObject lObj = (LiveObject)value;
        
        if(lObj != null && lObj.isEnabled()) {
            setForeground(Color.BLACK);
            if(isSelected) {
                setBackground(Color.ORANGE.brighter());
            } else {
                setBackground(Color.ORANGE);
            }
        } else if (isSelected) {
            setForeground(table.getSelectionForeground());
            setBackground(table.getSelectionBackground());
        } else {
            setForeground(table.getForeground());
            setBackground(table.getBackground());
        }

        if(lObj != null) {
            setText(lObj.getSoundObject().getName());
        } else {
            setText("");
        }
        
        if(set != null && set.contains(lObj)) {
            putClientProperty(HIGHGLIGHTED, Boolean.TRUE);
        } else {
            putClientProperty(HIGHGLIGHTED, Boolean.FALSE);
        }
        
        return this;
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Boolean b = (Boolean)getClientProperty(HIGHGLIGHTED);
        
        if(b) {
            g.setColor(HIGHLIGHT_PAINT);
            Rectangle r = g.getClipBounds();
            g.fillRect(r.x, r.y, r.width, r.height);
        }
        
    }

    
}
