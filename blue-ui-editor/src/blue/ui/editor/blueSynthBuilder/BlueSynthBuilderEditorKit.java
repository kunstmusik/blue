/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.blueSynthBuilder;

import blue.ui.editor.csound.orc.*;
import javax.swing.text.Document;
import org.netbeans.api.lexer.Language;
import org.netbeans.modules.editor.NbEditorDocument;
import org.netbeans.modules.editor.NbEditorKit;

/**
 *
 * @author stevenyi
 */
public class BlueSynthBuilderEditorKit extends NbEditorKit {

    @Override
    public Document createDefaultDocument() {
        
        Document doc = new BlueSynthBuilderEditorDocument(getContentType());
        doc.putProperty(Language.class, CsoundOrcTokenId.language());
        return doc;
        
    }
    
    @Override
    public String getContentType() {
        return "text/x-blue-synth-builder";
    }
    
    public class BlueSynthBuilderEditorDocument extends NbEditorDocument {
        
        public BlueSynthBuilderEditorDocument(String mimeType) {
            super(mimeType);
        }
    }
}
