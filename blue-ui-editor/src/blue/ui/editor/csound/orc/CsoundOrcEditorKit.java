/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import javax.swing.text.Document;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;

/**
 *
 * @author stevenyi
 */
public class CsoundOrcEditorKit extends NbEditorKit {

    @Override
    public Document createDefaultDocument() {
        
        Document doc = new CsoundOrcEditorDocument(getContentType());
        doc.putProperty(Language.class, CsoundOrcTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-csound-orc";
    }
    
    public class CsoundOrcEditorDocument extends NbEditorDocument {

        public CsoundOrcEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
