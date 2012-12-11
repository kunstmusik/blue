/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.objectBuilder;

import blue.ui.editor.csound.sco.*;
import blue.ui.editor.csound.orc.*;
import javax.swing.text.Document;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;

/**
 *
 * @author stevenyi
 */
public class ObjectBuilderEditorKit extends NbEditorKit {

    @Override
    public Document createDefaultDocument() {
        
        Document doc = new ObjectBuilderEditorDocument(getContentType());
//        doc.putProperty(Language.class, CsoundOrcTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-object-builder";
    }
    
    public class ObjectBuilderEditorDocument extends NbEditorDocument {

        public ObjectBuilderEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
