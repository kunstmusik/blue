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
package org.netbeans.modules.javascript2.editor.lexer;

import javax.swing.text.Document;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;

/**
 *
 * @author stevenyi
 */
public class JsEditorKit extends NbEditorKit {

    @Override
    public Document createDefaultDocument() {
        
        Document doc = new JsEditorKit.JsDocument(getContentType());
        doc.putProperty(Language.class, JsTokenId.javascriptLanguage());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/javascript";
    }
    
    public class JsDocument extends NbEditorDocument {

        public JsDocument(String mimeType) {
            super(mimeType);
        }
    }
}
