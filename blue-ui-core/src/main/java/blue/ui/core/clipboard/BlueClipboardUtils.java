/*
 * blue - object composition environment for csound
 * Copyright (C) 2021
 * Steven Yi <stevenyi@gmail.com>
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
package blue.ui.core.clipboard;

import blue.ui.core.score.ScoreObjectCopy;
import java.awt.GraphicsEnvironment;
import java.awt.Toolkit;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.io.IOException;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;

/**
 *
 * @author stevenyi
 */
public class BlueClipboardUtils {
    
    
    /** Matches implementation in org.netbeans.modules.openide.explorer.ExplorerActionsImpl
     */
    public static Clipboard getClipboard() {
        if (GraphicsEnvironment.isHeadless()) {
            return null;
        }
        Clipboard c = Lookup.getDefault().lookup(Clipboard.class);

        if (c == null) {
            c = Toolkit.getDefaultToolkit().getSystemClipboard();
        }

        return c;
    
    }
    
    public static ScoreObjectCopy getScoreObjectCopy() {
        var c = getClipboard();
        if(c.isDataFlavorAvailable(ScoreObjectCopy.DATA_FLAVOR)) {
            try {
                return (ScoreObjectCopy) c.getData(ScoreObjectCopy.DATA_FLAVOR);
            } catch (UnsupportedFlavorException ex) {
                Exceptions.printStackTrace(ex);
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
        }
        return null;
    }
}
