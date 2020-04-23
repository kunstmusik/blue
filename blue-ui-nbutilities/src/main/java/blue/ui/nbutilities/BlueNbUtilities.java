/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.ui.nbutilities;

import java.awt.Component;
import java.awt.Frame;
import javax.swing.JEditorPane;
import javax.swing.JScrollPane;
import javax.swing.text.EditorKit;
import org.netbeans.editor.BaseDocument;
import org.netbeans.editor.Utilities;
import org.openide.text.CloneableEditorSupport;
import org.openide.text.NbDocument;

/**
 *
 * @author stevenyi
 */
public class BlueNbUtilities {
    
    static Frame mainWindow = null;
    
    public static void setMainWindow(Frame frame) {
        mainWindow = frame;
    }
    public static Frame getMainWindow() {
        return mainWindow;
    }
    

    /** Returns the original JEditorPane or the Netbeans Extended
     * Editor for the mimeType */
    public static Component convertEditorForMimeType(JEditorPane editor, String mimeType) {
        Component retVal = editor;
        
        EditorKit kit = CloneableEditorSupport.getEditorKit(mimeType);
        editor.setEditorKit(kit);
        editor.setDocument(kit.createDefaultDocument());
        
        BaseDocument doc = Utilities.getDocument(editor);
        
        if (doc instanceof NbDocument.CustomEditor) {
            NbDocument.CustomEditor ce = (NbDocument.CustomEditor) doc;
            retVal = ce.createEditor(editor);
        } else {
            retVal = new JScrollPane(retVal);
        }
        
        return retVal;
        
    }
}
