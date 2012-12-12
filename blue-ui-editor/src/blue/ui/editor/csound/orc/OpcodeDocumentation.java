/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import org.openide.modules.InstalledFileLocator;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class OpcodeDocumentation {
    public static String getOpcodeDocumentation(String opcodeName) {
        StringBuffer buffer = new StringBuffer();
        
        File manualDir = InstalledFileLocator.getDefault().
                locate("csoundManual", "csound-manual", false);
        
        String filename = manualDir.getAbsolutePath() + "/" + opcodeName + ".html";
        File docFile = new File(filename);
        
        if(!docFile.exists() || !docFile.isFile() || !docFile.canRead()) {
            return null;
        }
        
        boolean appending = false;
                
        String imgDir = "src=\"file://" + manualDir + "/images";
        
        try {
            BufferedReader br = new BufferedReader(new FileReader(docFile));
            String line;
            while ((line = br.readLine().trim()) != null) {
                
                line = line.replace("src=\"images", imgDir);
                
                if(appending) {
                    if(line.startsWith("<div class=\"navfooter\">")) {
                        break;
                    }
                    buffer.append(line).append("\n");
                } else {
                    if(line.startsWith("<div class=\"refentry\"")) {
                        
                        buffer.append(line).append("\n");
                    } else if(line.startsWith("<div class=\"refnamediv\">")) {
                        appending = true;
                        buffer.append(line).append("\n");
                    }
                }
            }

            br.close();
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
        
        return buffer.toString();   
    }
}
