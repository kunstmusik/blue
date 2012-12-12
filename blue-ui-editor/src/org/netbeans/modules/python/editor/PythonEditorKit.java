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
package org.netbeans.modules.python.editor;

import javax.swing.Action;
import javax.swing.text.Document;
import javax.swing.text.TextAction;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;
import org.netbeans.modules.python.editor.lexer.PythonTokenId;

/**
 *
 * @author stevenyi
 */
public class PythonEditorKit extends NbEditorKit {

    @Override
    protected Action[] createActions() {
        Action[] nbEditorActions = new Action[] {
                                      new ToggleCommentAction("#"),
                                   };
        return TextAction.augmentList(super.createActions(), nbEditorActions);
    }
    
    @Override
    public Document createDefaultDocument() {
        Document doc = new PythonEditorKit.PythonDocument(getContentType());
        doc.putProperty(Language.class, PythonTokenId.language());
        return doc;  
    }
    
    @Override
    public String getContentType() {
        return "text/x-python";
    }
    
    public class PythonDocument extends NbEditorDocument {

        public PythonDocument(String mimeType) {
            super(mimeType);
        }
    }
}
